"use client";

import { useMemo, useState } from "react";
import { decodeFunctionResult, encodeFunctionData, formatUnits, parseUnits } from "viem";
import { ArrowDownToLine, ArrowUpFromLine, Gift, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import type { MarketContext, Opportunity } from "@/lib/types";
import { formatCompactUsd, formatPercent } from "@/lib/utils";
import { ARC_TESTNET_CHAIN } from "@/services/arc";
import {
  ARC_POOL_APY,
  ARC_POOL_CONTRACT_ADDRESS,
  ARC_POOL_OWNER,
  ARC_POOL_TOKEN_ADDRESS,
  ARC_POOL_TOKEN_DECIMALS,
  ARC_POOL_TOKEN_SYMBOL,
  ARC_YIELD_POOL_ABI,
  ERC20_APPROVE_ABI,
  estimateRewards,
  isPoolContractConfigured
} from "@/services/pool";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function YieldDashboard({
  initialOpportunities,
  initialMarketContext
}: {
  initialOpportunities: Opportunity[];
  initialMarketContext: MarketContext;
}) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState(0);
  const [demoStakedAmount, setDemoStakedAmount] = useState(0);
  const [onchainStakedAmount, setOnchainStakedAmount] = useState(0);
  const [onchainAccruedRewards, setOnchainAccruedRewards] = useState(0);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const estimate = useMemo(() => estimateRewards(depositAmount), [depositAmount]);
  const stakedAmount = contractReady ? onchainStakedAmount : demoStakedAmount;
  const position = useMemo(() => estimateRewards(stakedAmount), [stakedAmount]);
  const poolTvl = initialOpportunities.reduce((sum, item) => sum + item.tvlUsd, 0);
  const contractReady = isPoolContractConfigured();

  async function connectWallet() {
    setWalletError(null);
    if (!window.ethereum) {
      setWalletError("Install a browser wallet to connect.");
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      const account = accounts[0] ?? null;
      setWalletAddress(account);

      if (ARC_TESTNET_CHAIN.chainId > 0 && ARC_TESTNET_CHAIN.rpcUrl) {
        const chainParams: {
          chainId: string;
          chainName: string;
          rpcUrls: string[];
          blockExplorerUrls?: string[];
          nativeCurrency: { name: string; symbol: string; decimals: number };
        } = {
          chainId: `0x${ARC_TESTNET_CHAIN.chainId.toString(16)}`,
          chainName: ARC_TESTNET_CHAIN.name,
          rpcUrls: [ARC_TESTNET_CHAIN.rpcUrl],
          nativeCurrency: { name: "ARC", symbol: "ARC", decimals: 18 }
        };
        if (ARC_TESTNET_CHAIN.explorerUrl) chainParams.blockExplorerUrls = [ARC_TESTNET_CHAIN.explorerUrl];

        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [chainParams]
        }).catch(() => undefined);
      }

      if (account) await refreshPoolPosition(account);
    } catch {
      setWalletError("Wallet connection was cancelled or failed.");
    }
  }

  async function refreshPoolPosition(account = walletAddress) {
    if (!window.ethereum || !account || !contractReady) return;

    try {
      const positionData = encodeFunctionData({
        abi: ARC_YIELD_POOL_ABI,
        functionName: "positions",
        args: [account as `0x${string}`]
      });
      const pendingRewardsData = encodeFunctionData({
        abi: ARC_YIELD_POOL_ABI,
        functionName: "pendingRewards",
        args: [account as `0x${string}`]
      });

      const rawPosition = await window.ethereum.request({
        method: "eth_call",
        params: [{ to: ARC_POOL_CONTRACT_ADDRESS, data: positionData }, "latest"]
      }) as `0x${string}`;
      const rawRewards = await window.ethereum.request({
        method: "eth_call",
        params: [{ to: ARC_POOL_CONTRACT_ADDRESS, data: pendingRewardsData }, "latest"]
      }) as `0x${string}`;

      const [principal] = decodeFunctionResult({
        abi: ARC_YIELD_POOL_ABI,
        functionName: "positions",
        data: rawPosition
      });
      const rewards = decodeFunctionResult({
        abi: ARC_YIELD_POOL_ABI,
        functionName: "pendingRewards",
        data: rawRewards
      });

      setOnchainStakedAmount(Number(formatUnits(principal, ARC_POOL_TOKEN_DECIMALS)));
      setOnchainAccruedRewards(Number(formatUnits(rewards, ARC_POOL_TOKEN_DECIMALS)));
    } catch {
      setWalletError("Could not read your pool position. Check that your wallet is on Arc Testnet.");
    }
  }

  async function sendPoolTransaction(action: "deposit" | "withdraw" | "claim") {
    setWalletError(null);
    setActionMessage(null);

    if (!walletAddress) {
      setWalletError("Connect your wallet first.");
      return;
    }

    if (action === "deposit" && estimate.principal <= 0) {
      setWalletError("Enter an amount greater than 0.");
      return;
    }

    if (!contractReady) {
      if (action === "deposit") {
        setDemoStakedAmount((current) => Number((current + estimate.principal).toFixed(6)));
        setActionMessage(`Demo deposit recorded: ${estimate.principal.toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL}.`);
      }
      if (action === "withdraw") {
        setDemoStakedAmount(0);
        setActionMessage("Demo position withdrawn.");
      }
      if (action === "claim") {
        setActionMessage(`Demo rewards claimed: ${position.monthlyRewards.toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL} estimated monthly rewards.`);
      }
      return;
    }

    if (!window.ethereum) {
      setWalletError("Install a browser wallet to continue.");
      return;
    }

    if (action === "withdraw" && onchainStakedAmount <= 0) {
      setWalletError("No staked balance found to withdraw. Refresh your position after the deposit confirms.");
      return;
    }

    if (action === "deposit" && !ARC_POOL_TOKEN_ADDRESS) {
      setWalletError("Set the USDC (ARC) token contract address before on-chain deposits.");
      return;
    }

    const amount = action === "withdraw" ? onchainStakedAmount : estimate.principal;
    const amountUnits = parseUnits(String(amount), ARC_POOL_TOKEN_DECIMALS);

    try {
      if (action === "deposit") {
        await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [{
            from: walletAddress,
            to: ARC_POOL_TOKEN_ADDRESS,
            data: encodeFunctionData({
              abi: ERC20_APPROVE_ABI,
              functionName: "approve",
              args: [ARC_POOL_CONTRACT_ADDRESS as `0x${string}`, amountUnits]
            })
          }]
        });
      }

      const data = action === "deposit"
        ? encodeFunctionData({ abi: ARC_YIELD_POOL_ABI, functionName: "deposit", args: [amountUnits] })
        : action === "withdraw"
          ? encodeFunctionData({ abi: ARC_YIELD_POOL_ABI, functionName: "withdraw", args: [amountUnits] })
          : encodeFunctionData({ abi: ARC_YIELD_POOL_ABI, functionName: "claimRewards" });

      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from: walletAddress, to: ARC_POOL_CONTRACT_ADDRESS, data }]
      });

      if (action === "deposit") setDemoStakedAmount((current) => Number((current + estimate.principal).toFixed(6)));
      if (action === "withdraw") setDemoStakedAmount(0);
      const hash = String(txHash);
      setActionMessage(`Transaction submitted: ${hash.slice(0, 10)}...${hash.slice(-8)}`);
      window.setTimeout(() => void refreshPoolPosition(), 5000);
    } catch {
      setWalletError("Transaction was rejected or failed.");
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">ARC Yield Pool</h1>
            <p className="text-sm text-muted-foreground">Owner-operated USDC (ARC) pool with transparent 5% estimated APY</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden gap-3 text-right text-xs text-muted-foreground sm:flex">
              <span>BTC {formatCompactUsd(initialMarketContext.bitcoinUsd)} ({initialMarketContext.bitcoin24hChange.toFixed(1)}%)</span>
              <span>ETH {formatCompactUsd(initialMarketContext.ethereumUsd)} ({initialMarketContext.ethereum24hChange.toFixed(1)}%)</span>
            </div>
            <Button variant={walletAddress ? "secondary" : "default"} onClick={connectWallet}>
              <Wallet className="h-4 w-4" />
              {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Connect"}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-4 p-4 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <aside className="space-y-4 rounded-lg border bg-card p-4 xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
          <div>
            <h2 className="text-sm font-semibold">Deposit</h2>
            <p className="text-xs text-muted-foreground">Deposit USDC (ARC) into your pool</p>
          </div>

          <div className="rounded-md border p-3 text-sm">
            <InfoLine label="Pool owner" value={ARC_POOL_OWNER} />
            <InfoLine label="Network" value={ARC_TESTNET_CHAIN.name} />
            <InfoLine label="Contract" value={contractReady ? `${ARC_POOL_CONTRACT_ADDRESS.slice(0, 6)}...${ARC_POOL_CONTRACT_ADDRESS.slice(-4)}` : "Demo mode"} />
          </div>

          <label className="block space-y-2 text-sm">
            <span className="text-muted-foreground">Amount ({ARC_POOL_TOKEN_SYMBOL})</span>
            <Input type="number" min={0} value={depositAmount} onChange={(event) => setDepositAmount(Number(event.target.value))} />
          </label>

          {walletError && <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{walletError}</p>}
          {actionMessage && <p className="overflow-hidden break-words rounded-md border bg-secondary p-2 text-xs text-secondary-foreground">{actionMessage}</p>}

          <div className="grid gap-2">
            <Button onClick={() => void sendPoolTransaction("deposit")}>
              <ArrowDownToLine className="h-4 w-4" />
              Deposit
            </Button>
            <Button variant="outline" onClick={() => void sendPoolTransaction("withdraw")}>
              <ArrowUpFromLine className="h-4 w-4" />
              Withdraw
            </Button>
            <Button variant="outline" onClick={() => void sendPoolTransaction("claim")}>
              <Gift className="h-4 w-4" />
              Claim Rewards
            </Button>
          </div>
        </aside>

        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Estimated APY" value={formatPercent(ARC_POOL_APY)} />
            <StatCard label="Pool TVL" value={`${formatCompactUsd(poolTvl)} est.`} />
            <StatCard label="Asset" value={ARC_POOL_TOKEN_SYMBOL} />
            <StatCard label="Status" value={contractReady ? "Contract set" : "Demo mode"} />
          </div>

          <Card>
            <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              <DetailMetric label="Deposit amount" value={`${estimate.principal.toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL}`} />
              <DetailMetric label="Daily rewards" value={`${estimate.dailyRewards.toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL}`} />
              <DetailMetric label="Monthly rewards" value={`${estimate.monthlyRewards.toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL}`} />
              <DetailMetric label="Yearly rewards" value={`${estimate.yearlyRewards.toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL}`} />
              <DetailMetric label="Total after 1 year" value={`${estimate.totalAfterYear.toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL}`} />
              <DetailMetric label="APY used" value={formatPercent(estimate.apy)} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              <DetailMetric label="Wallet" value={walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Not connected"} />
              <DetailMetric label="Amount staked" value={`${position.principal.toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL}`} />
              <DetailMetric label="Accrued rewards" value={`${(contractReady ? onchainAccruedRewards : position.monthlyRewards).toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL} est.`} />
              <DetailMetric label="Estimated daily" value={`${position.dailyRewards.toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL}`} />
              <DetailMetric label="Estimated monthly" value={`${position.monthlyRewards.toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL}`} />
              <DetailMetric label="Estimated yearly" value={`${position.yearlyRewards.toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL}`} />
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-4 rounded-lg border bg-card p-4 xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Pool Summary</h2>
              <p className="text-sm text-muted-foreground">USDC yield on ARC</p>
            </div>
            <Badge>USDC (ARC)</Badge>
          </div>

          <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4" />
              Status
            </div>
            <InfoRow title="Asset" body="USDC (ARC)" />
            <InfoRow title="Estimated APY" body={`${ARC_POOL_APY}%`} />
            <InfoRow title="Pool owner" body={ARC_POOL_OWNER} />
            <InfoRow title="Contract status" body={contractReady ? "Contract address is configured." : "Demo mode until contract address is added."} />
          </section>

          <Button variant="outline" className="w-full" onClick={() => void refreshPoolPosition()}>
            <RefreshCw className="h-4 w-4" />
            Refresh Position
          </Button>
        </aside>
      </div>
    </main>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2 flex justify-between gap-3 last:mb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function InfoRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-sm font-medium">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
