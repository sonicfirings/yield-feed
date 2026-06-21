"use client";

import { useMemo, useState } from "react";
import { encodeFunctionData, parseEther } from "viem";
import { ArrowDownToLine, ArrowUpFromLine, Gift, Landmark, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import type { MarketContext, Opportunity } from "@/lib/types";
import { formatCompactUsd, formatPercent } from "@/lib/utils";
import { ARC_TESTNET_CHAIN } from "@/services/arc";
import { ARC_POOL_APY, ARC_POOL_CONTRACT_ADDRESS, ARC_POOL_OWNER, ARC_POOL_TOKEN_SYMBOL, ARC_YIELD_POOL_ABI, estimateRewards, isPoolContractConfigured } from "@/services/pool";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function YieldDashboard({ initialOpportunities, initialMarketContext }: { initialOpportunities: Opportunity[]; initialMarketContext: MarketContext }) {
  const [marketContext] = useState(initialMarketContext);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState(1000);
  const [demoStakedAmount, setDemoStakedAmount] = useState(0);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const estimate = useMemo(() => estimateRewards(depositAmount), [depositAmount]);
  const position = useMemo(() => estimateRewards(demoStakedAmount), [demoStakedAmount]);
  const fallbackPool = initialOpportunities[0];
  const poolTvl = initialOpportunities.reduce((sum, item) => sum + item.tvlUsd, 0) || fallbackPool?.tvlUsd || 0;
  const contractReady = isPoolContractConfigured();

  async function connectWallet() {
    setWalletError(null);
    if (!window.ethereum) {
      setWalletError("Install a browser wallet to connect.");
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      setWalletAddress(accounts[0] ?? null);

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
          nativeCurrency: { name: ARC_POOL_TOKEN_SYMBOL, symbol: ARC_POOL_TOKEN_SYMBOL, decimals: 18 }
        };
        if (ARC_TESTNET_CHAIN.explorerUrl) chainParams.blockExplorerUrls = [ARC_TESTNET_CHAIN.explorerUrl];

        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [chainParams]
        }).catch(() => undefined);
      }
    } catch {
      setWalletError("Wallet connection was cancelled or failed.");
    }
  }

  async function sendPoolTransaction(action: "deposit" | "withdraw" | "claim") {
    if (!walletAddress) {
      setWalletError("Connect your wallet first.");
      return;
    }

    if (!contractReady) {
      if (action === "deposit") {
        setDemoStakedAmount((current) => Number((current + estimate.principal).toFixed(6)));
        setActionMessage(`Demo deposit recorded: ${estimate.principal.toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL}. Add a contract address to make this on-chain.`);
      }
      if (action === "withdraw") {
        setDemoStakedAmount(0);
        setActionMessage("Demo position withdrawn. Add a contract address to withdraw on-chain.");
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

    const data = action === "deposit"
      ? encodeFunctionData({ abi: ARC_YIELD_POOL_ABI, functionName: "deposit" })
      : action === "withdraw"
        ? encodeFunctionData({ abi: ARC_YIELD_POOL_ABI, functionName: "withdraw", args: [parseEther(String(position.principal))] })
        : encodeFunctionData({ abi: ARC_YIELD_POOL_ABI, functionName: "claimRewards" });

    const transaction: Record<string, string> = {
      from: walletAddress,
      to: ARC_POOL_CONTRACT_ADDRESS,
      data
    };

    if (action === "deposit") {
      transaction.value = `0x${parseEther(String(estimate.principal)).toString(16)}`;
    }

    try {
      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [transaction]
      });
      setActionMessage(`Transaction submitted: ${String(txHash)}`);
      if (action === "deposit") setDemoStakedAmount((current) => Number((current + estimate.principal).toFixed(6)));
      if (action === "withdraw") setDemoStakedAmount(0);
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
            <p className="text-sm text-muted-foreground">Owner-operated ARC testnet pool with transparent 5% estimated APY</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden gap-3 text-right text-xs text-muted-foreground sm:flex">
              <span>BTC {formatCompactUsd(marketContext.bitcoinUsd)} ({marketContext.bitcoin24hChange.toFixed(1)}%)</span>
              <span>ETH {formatCompactUsd(marketContext.ethereumUsd)} ({marketContext.ethereum24hChange.toFixed(1)}%)</span>
            </div>
            <Button variant={walletAddress ? "secondary" : "default"} onClick={connectWallet}>
              <Wallet className="h-4 w-4" />
              {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Connect"}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-4 p-4 xl:grid-cols-[320px_minmax(0,1fr)_380px]">
        <aside className="space-y-4 rounded-lg border bg-card p-4 xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
          <div>
            <h2 className="text-sm font-semibold">Pool Control</h2>
            <p className="text-xs text-muted-foreground">Deposit into your ARC Yield Pool</p>
          </div>

          <div className="rounded-md border p-3 text-sm">
            <div className="mb-2 flex justify-between">
              <span className="text-muted-foreground">Pool owner</span>
              <span className="font-medium">{ARC_POOL_OWNER}</span>
            </div>
            <div className="mb-2 flex justify-between">
              <span className="text-muted-foreground">Network</span>
              <span className="font-medium">{ARC_TESTNET_CHAIN.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contract</span>
              <span className="font-medium">{contractReady ? `${ARC_POOL_CONTRACT_ADDRESS.slice(0, 6)}...${ARC_POOL_CONTRACT_ADDRESS.slice(-4)}` : "Not set"}</span>
            </div>
          </div>

          <label className="block space-y-2 text-sm">
            <span className="text-muted-foreground">Amount to deposit ({ARC_POOL_TOKEN_SYMBOL})</span>
            <Input type="number" min={0} value={depositAmount} onChange={(event) => setDepositAmount(Number(event.target.value))} />
          </label>

          {walletError && <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{walletError}</p>}
          {actionMessage && <p className="rounded-md border bg-secondary p-2 text-xs text-secondary-foreground">{actionMessage}</p>}

          <div className="grid grid-cols-1 gap-2">
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
            <StatCard label="Reward token" value={ARC_POOL_TOKEN_SYMBOL} />
            <StatCard label="Status" value={contractReady ? "On-chain ready" : "Demo mode"} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Deposit Estimate</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <DetailMetric label="Deposit amount" value={`${estimate.principal.toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL}`} />
              <DetailMetric label="Daily rewards" value={`${estimate.dailyRewards.toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL}`} />
              <DetailMetric label="Monthly rewards" value={`${estimate.monthlyRewards.toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL}`} />
              <DetailMetric label="Yearly rewards" value={`${estimate.yearlyRewards.toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL}`} />
              <DetailMetric label="Total after 1 year" value={`${estimate.totalAfterYear.toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL}`} />
              <DetailMetric label="APY used" value={formatPercent(estimate.apy)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Position</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <DetailMetric label="Wallet" value={walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Not connected"} />
              <DetailMetric label="Amount staked" value={`${position.principal.toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL}`} />
              <DetailMetric label="Accrued rewards" value={`${position.monthlyRewards.toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL} est.`} />
              <DetailMetric label="Estimated daily" value={`${position.dailyRewards.toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL}`} />
              <DetailMetric label="Estimated monthly" value={`${position.monthlyRewards.toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL}`} />
              <DetailMetric label="Estimated yearly" value={`${position.yearlyRewards.toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL}`} />
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-4 rounded-lg border bg-card p-4 xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)] xl:overflow-auto">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Pool Details</h2>
                <p className="text-sm text-muted-foreground">Smart contract custody model</p>
              </div>
              <Badge>{ARC_TESTNET_CHAIN.name}</Badge>
            </div>
          </div>

          <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4" />
              How It Works
            </div>
            <InfoRow title="Custody" body="Users deposit into the pool contract. The contract records each wallet balance." />
            <InfoRow title="Rewards" body={`Rewards are estimated at ${ARC_POOL_APY}% APY and shown before the user deposits.`} />
            <InfoRow title="Owner" body="The pool belongs to you as admin. Rewards should be funded by the pool owner or protocol treasury." />
            <InfoRow title="Testnet" body="This interface is designed for ARC testnet and should not promise guaranteed real-money returns." />
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Landmark className="h-4 w-4" />
              Admin Checklist
            </div>
            <InfoRow title="Deploy contract" body="Deploy a staking pool contract with deposit, withdraw, claim, and reward accounting." />
            <InfoRow title="Set env vars" body="Add the ARC chain ID, RPC URL, token symbol, pool owner, and pool contract address in Vercel." />
            <InfoRow title="Wire ABI" body="Add the contract ABI so these buttons can submit real on-chain transactions." />
          </section>

          <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" />
            Refresh Pool
          </Button>
        </aside>
      </div>
    </main>
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
