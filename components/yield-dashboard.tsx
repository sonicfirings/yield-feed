"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { decodeFunctionResult, encodeFunctionData, formatUnits, parseUnits } from "viem";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ExternalLink,
  Gift,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Wallet
} from "lucide-react";
import { formatPercent } from "@/lib/utils";
import { ARC_TESTNET_CHAIN } from "@/services/arc";
import {
  ARC_POOL_APY,
  ARC_POOL_CONTRACT_ADDRESS,
  ARC_POOL_OWNER,
  ARC_POOL_TOKEN_ADDRESS,
  ARC_POOL_TOKEN_DECIMALS,
  ARC_POOL_TOKEN_SYMBOL,
  ARC_EARLY_BOOST_APY,
  ARC_YIELD_POOL_ABI,
  ERC20_APPROVE_ABI,
  LOCK_OPTIONS,
  compoundedYearlyReturn,
  estimateRewards,
  isPoolContractConfigured
} from "@/services/pool";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function YieldDashboard() {
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  const [selectedLockDays, setSelectedLockDays] = useState(0);
  const [autoCompound, setAutoCompound] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [demoStakedAmount, setDemoStakedAmount] = useState(0);
  const [onchainStakedAmount, setOnchainStakedAmount] = useState(0);
  const [onchainAccruedRewards, setOnchainAccruedRewards] = useState(0);
  const [positionUpdatedAt, setPositionUpdatedAt] = useState(0);
  const [positionUnlockAt, setPositionUnlockAt] = useState(0);
  const [positionApy, setPositionApy] = useState(ARC_POOL_APY);
  const [positionAutoCompound, setPositionAutoCompound] = useState(false);
  const [walletUsdcBalance, setWalletUsdcBalance] = useState(0);
  const [poolBalance, setPoolBalance] = useState(0);
  const [totalPrincipal, setTotalPrincipal] = useState(0);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const depositValue = Number(depositAmount || 0);
  const withdrawValue = Number(withdrawAmount || 0);
  const selectedLock = LOCK_OPTIONS.find((option) => option.days === selectedLockDays) ?? LOCK_OPTIONS[0];
  const effectiveDepositApy = selectedLock.apy + ARC_EARLY_BOOST_APY;
  const estimate = useMemo(() => estimateRewards(depositValue, effectiveDepositApy), [depositValue, effectiveDepositApy]);
  const contractReady = isPoolContractConfigured();
  const stakedAmount = contractReady ? onchainStakedAmount : demoStakedAmount;
  const position = useMemo(() => estimateRewards(stakedAmount, contractReady ? positionApy : effectiveDepositApy), [contractReady, effectiveDepositApy, positionApy, stakedAmount]);
  const poolTvl = contractReady ? poolBalance : 0;
  const rewardReserve = Math.max(0, poolBalance - totalPrincipal);
  const yearlyRewardObligation = totalPrincipal * (ARC_POOL_APY / 100);
  const runwayDays = yearlyRewardObligation > 0 ? (rewardReserve / yearlyRewardObligation) * 365 : 0;
  const poolHealth = getPoolHealth(runwayDays, rewardReserve, totalPrincipal);
  const compoundedYearlyRewards = compoundedYearlyReturn(depositValue, effectiveDepositApy);
  const positionLocked = contractReady && positionUnlockAt > Math.floor(Date.now() / 1000);
  const depositTooHigh = contractReady && estimate.principal > walletUsdcBalance;
  const withdrawTooHigh = withdrawValue > position.principal;
  const depositDisabled =
    !walletAddress ||
    estimate.principal <= 0 ||
    depositTooHigh ||
    (contractReady && !ARC_POOL_TOKEN_ADDRESS);
  const withdrawDisabled =
    !walletAddress ||
    withdrawValue <= 0 ||
    withdrawTooHigh ||
    position.principal <= 0 ||
    positionLocked;
  const hasActivePosition = position.principal > 0;
  const activePositionLockDays = inferPositionLockDays(positionUpdatedAt, positionUnlockAt, positionApy);
  const activePositionStrategy = hasActivePosition ? getStrategyName(activePositionLockDays) : "No active stake";
  const selectedStrategyHasPosition = hasActivePosition && activePositionLockDays === selectedLockDays;
  const strategyMismatch = hasActivePosition && activePositionLockDays !== selectedLockDays;
  const depositBlockedByStrategy = contractReady && strategyMismatch;
  const finalDepositDisabled = depositDisabled || depositBlockedByStrategy;
  const unlockProgress = selectedStrategyHasPosition ? getUnlockProgress(positionUnlockAt, activePositionLockDays) : { percent: 0, daysLeft: 0 };
  const timelineLabel = getTimelineLabel(selectedLockDays, selectedStrategyHasPosition, positionLocked, positionUnlockAt, unlockProgress.daysLeft);
  const timelineSteps = getTimelineSteps(selectedLockDays);
  const contractUrl = ARC_TESTNET_CHAIN.explorerUrl && ARC_POOL_CONTRACT_ADDRESS
    ? `${ARC_TESTNET_CHAIN.explorerUrl.replace(/\/$/, "")}/address/${ARC_POOL_CONTRACT_ADDRESS}`
    : "";
  const positionRewards = contractReady ? onchainAccruedRewards : position.monthlyRewards;

  useEffect(() => {
    void refreshPoolBalance();
    // The first pool read is intentionally a one-time hydration call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }
        };
        if (ARC_TESTNET_CHAIN.explorerUrl) chainParams.blockExplorerUrls = [ARC_TESTNET_CHAIN.explorerUrl];

        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [chainParams]
        }).catch(() => undefined);
      }

      if (account) {
        await refreshWalletBalance(account);
        await refreshPoolPosition(account);
      }
    } catch {
      setWalletError("Wallet connection was cancelled or failed.");
    }
  }

  async function readContract(to: string, data: `0x${string}`) {
    const call = { to, data };

    if (ARC_TESTNET_CHAIN.rpcUrl) {
      try {
        const response = await fetch(ARC_TESTNET_CHAIN.rpcUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_call",
            params: [call, "latest"]
          })
        });
        const body = await response.json();
        if (body.error) throw new Error(body.error.message);
        if (!body.result) throw new Error("RPC returned no result");
        return body.result as `0x${string}`;
      } catch {
        // If the public RPC is temporarily unavailable, fall back to the wallet provider.
      }
    }

    if (!window.ethereum) throw new Error("Missing RPC provider");
    return await window.ethereum.request({
      method: "eth_call",
      params: [call, "latest"]
    }) as `0x${string}`;
  }

  async function refreshPoolBalance() {
    if (!contractReady || !ARC_POOL_TOKEN_ADDRESS || !ARC_POOL_CONTRACT_ADDRESS) return;

    try {
      const balanceData = encodeFunctionData({
        abi: ERC20_APPROVE_ABI,
        functionName: "balanceOf",
        args: [ARC_POOL_CONTRACT_ADDRESS as `0x${string}`]
      });
      const rawBalance = await readContract(ARC_POOL_TOKEN_ADDRESS, balanceData);
      const balance = decodeFunctionResult({
        abi: ERC20_APPROVE_ABI,
        functionName: "balanceOf",
        data: rawBalance
      });
      setPoolBalance(Number(formatUnits(balance, ARC_POOL_TOKEN_DECIMALS)));
    } catch {
      setPoolBalance(0);
    }

    try {
      const totalPrincipalData = encodeFunctionData({
        abi: ARC_YIELD_POOL_ABI,
        functionName: "totalPrincipal"
      });
      const rawTotalPrincipal = await readContract(ARC_POOL_CONTRACT_ADDRESS, totalPrincipalData);
      const principal = decodeFunctionResult({
        abi: ARC_YIELD_POOL_ABI,
        functionName: "totalPrincipal",
        data: rawTotalPrincipal
      });
      setTotalPrincipal(Number(formatUnits(principal, ARC_POOL_TOKEN_DECIMALS)));
    } catch {
      setTotalPrincipal(0);
    }
  }

  async function refreshWalletBalance(account = walletAddress) {
    if (!account || !ARC_POOL_TOKEN_ADDRESS) return;

    try {
      const balanceData = encodeFunctionData({
        abi: ERC20_APPROVE_ABI,
        functionName: "balanceOf",
        args: [account as `0x${string}`]
      });
      const rawBalance = await readContract(ARC_POOL_TOKEN_ADDRESS, balanceData);
      const balance = decodeFunctionResult({
        abi: ERC20_APPROVE_ABI,
        functionName: "balanceOf",
        data: rawBalance
      });
      setWalletUsdcBalance(Number(formatUnits(balance, ARC_POOL_TOKEN_DECIMALS)));
    } catch {
      setWalletUsdcBalance(0);
    }
  }

  async function refreshPoolPosition(account = walletAddress) {
    if (!account || !contractReady) return;

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

      const rawPosition = await readContract(ARC_POOL_CONTRACT_ADDRESS, positionData);
      const rawRewards = await readContract(ARC_POOL_CONTRACT_ADDRESS, pendingRewardsData);

      const [principal, , updatedAt, unlockAt, apyBps, autoCompoundEnabled] = decodeFunctionResult({
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
      setPositionUpdatedAt(Number(updatedAt));
      setPositionUnlockAt(Number(unlockAt));
      setPositionApy(Number(apyBps) / 100);
      setPositionAutoCompound(Boolean(autoCompoundEnabled));
      await refreshWalletBalance(account);
      await refreshPoolBalance();
    } catch {
      setWalletError("Could not read your pool position. Check the Arc RPC and pool contract address, then refresh.");
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

    if (action === "deposit" && contractReady && estimate.principal > walletUsdcBalance) {
      setWalletError(`Insufficient ${ARC_POOL_TOKEN_SYMBOL} balance.`);
      return;
    }

    if (action === "deposit" && contractReady && strategyMismatch) {
      setWalletError(`You already have an active ${activePositionStrategy} position. Withdraw after unlock before changing strategy.`);
      return;
    }

    if (!contractReady) {
      if (action === "deposit") {
        setDemoStakedAmount((current) => Number((current + estimate.principal).toFixed(6)));
        setActionMessage(`Demo deposit recorded: ${estimate.principal.toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL}.`);
      }
      if (action === "withdraw") {
        if (withdrawValue <= 0) {
          setWalletError("Enter a withdrawal amount greater than 0.");
          return;
        }
        if (withdrawValue > demoStakedAmount) {
          setWalletError(`Insufficient staked ${ARC_POOL_TOKEN_SYMBOL} balance.`);
          return;
        }
        setDemoStakedAmount((current) => Math.max(0, Number((current - withdrawValue).toFixed(6))));
        setWithdrawAmount("");
        setActionMessage(`Demo withdrawal recorded: ${withdrawValue.toLocaleString()} ${ARC_POOL_TOKEN_SYMBOL}.`);
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

    if (action === "withdraw" && withdrawValue <= 0) {
      setWalletError("Enter a withdrawal amount greater than 0.");
      return;
    }

    if (action === "withdraw" && withdrawValue > onchainStakedAmount) {
      setWalletError(`Insufficient staked ${ARC_POOL_TOKEN_SYMBOL} balance.`);
      return;
    }

    if (action === "deposit" && !ARC_POOL_TOKEN_ADDRESS) {
      setWalletError("Set the USDC (ARC) token contract address before on-chain deposits.");
      return;
    }

    const amount = action === "withdraw" ? withdrawValue : estimate.principal;
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
        ? encodeFunctionData({ abi: ARC_YIELD_POOL_ABI, functionName: "deposit", args: [amountUnits, BigInt(selectedLockDays), autoCompound] })
        : action === "withdraw"
          ? encodeFunctionData({ abi: ARC_YIELD_POOL_ABI, functionName: "withdraw", args: [amountUnits] })
          : encodeFunctionData({ abi: ARC_YIELD_POOL_ABI, functionName: "claimRewards" });

      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from: walletAddress, to: ARC_POOL_CONTRACT_ADDRESS, data }]
      });

      if (action === "deposit") setDemoStakedAmount((current) => Number((current + estimate.principal).toFixed(6)));
      if (action === "withdraw") {
        setDemoStakedAmount((current) => Math.max(0, Number((current - withdrawValue).toFixed(6))));
        setWithdrawAmount("");
      }
      const hash = String(txHash);
      setActionMessage(`Transaction submitted: ${hash.slice(0, 10)}...${hash.slice(-8)}`);
      window.setTimeout(() => {
        void refreshWalletBalance();
        void refreshPoolPosition();
        void refreshPoolBalance();
      }, 5000);
    } catch {
      setWalletError("Transaction was rejected or failed.");
    }
  }

  function setQuickAmount(value: number) {
    setDepositAmount(formatTokenAmount(value));
    setWalletError(null);
  }

  function setQuickWithdrawAmount(value: number) {
    setWithdrawAmount(formatTokenAmount(value));
    setWalletError(null);
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <div className="border-b border-border/70 bg-background/95">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-5 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
              <HalcyonMark />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-normal">Halcyon</h1>
                <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">V3</span>
              </div>
              <p className="text-sm text-muted-foreground">USDC-native pool dashboard · Built on Arc testnet</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://faucet.circle.com/"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Faucet
            </a>
            <Button variant={walletAddress ? "secondary" : "default"} onClick={connectWallet}>
              <Wallet className="h-4 w-4" />
              {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Connect Wallet"}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid h-[calc(100vh-61px)] max-w-[1500px] grid-cols-1 gap-3 overflow-hidden p-3 xl:grid-cols-[330px_minmax(0,1fr)_330px]">
        <aside className="space-y-3 overflow-hidden">
          <Panel>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Choose strategy</h2>
                <p className="text-xs text-muted-foreground">Same pool, different yield paths.</p>
              </div>
              <Target className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-2">
              {LOCK_OPTIONS.map((option) => (
                <StrategyCard
                  key={option.days}
                  active={selectedLockDays === option.days}
                  label={option.label}
                  apy={option.apy + ARC_EARLY_BOOST_APY}
                  description={getStrategyDescription(option.days)}
                  activeStakeAmount={hasActivePosition && activePositionLockDays === option.days ? `${formatAmount(position.principal)} ${ARC_POOL_TOKEN_SYMBOL}` : ""}
                  onClick={() => setSelectedLockDays(option.days)}
                />
              ))}
            </div>
          </Panel>

          <Panel>
            <div className="mb-3 grid grid-cols-2 rounded-md border border-border bg-secondary/50 p-1">
              <TabButton active={activeTab === "deposit"} onClick={() => setActiveTab("deposit")}>Deposit</TabButton>
              <TabButton active={activeTab === "withdraw"} onClick={() => setActiveTab("withdraw")}>Withdraw</TabButton>
            </div>

            <div className="mb-3 rounded-md border border-border bg-background/40 p-2.5 text-sm">
              <InfoLine label="Pool owner" value={ARC_POOL_OWNER} />
              <InfoLine label="Network" value={ARC_TESTNET_CHAIN.name} />
              <InfoLine label="Contract" value={contractReady ? `${ARC_POOL_CONTRACT_ADDRESS.slice(0, 6)}...${ARC_POOL_CONTRACT_ADDRESS.slice(-4)}` : "Demo mode"} />
            </div>

            {activeTab === "deposit" ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setAutoCompound((current) => !current)}
                  className="flex w-full items-center justify-between rounded-md border border-border bg-background/40 p-2.5 text-left text-sm transition-colors hover:bg-secondary"
                >
                  <span>
                    <span className="block font-medium">Auto-compound</span>
                    <span className="text-xs text-muted-foreground">Roll rewards back into principal</span>
                  </span>
                  <span className={autoCompound ? "rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground" : "rounded-md bg-secondary px-2 py-1 text-xs font-semibold"}>
                    {autoCompound ? "On" : "Off"}
                  </span>
                </button>
                <label className="block space-y-2 text-sm">
                  <span className="text-muted-foreground">Amount ({ARC_POOL_TOKEN_SYMBOL})</span>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0.00"
                    value={depositAmount}
                    onChange={(event) => {
                      setDepositAmount(event.target.value);
                      setWalletError(null);
                    }}
                    className="h-10 text-base"
                  />
                </label>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Wallet balance</span>
                  <span>{walletAddress ? `${formatAmount(walletUsdcBalance)} ${ARC_POOL_TOKEN_SYMBOL}` : "Please connect wallet"}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <QuickAmountButton label="25%" disabled={!walletAddress || walletUsdcBalance <= 0} onClick={() => setQuickAmount(walletUsdcBalance * 0.25)} />
                  <QuickAmountButton label="50%" disabled={!walletAddress || walletUsdcBalance <= 0} onClick={() => setQuickAmount(walletUsdcBalance * 0.5)} />
                  <QuickAmountButton label="75%" disabled={!walletAddress || walletUsdcBalance <= 0} onClick={() => setQuickAmount(walletUsdcBalance * 0.75)} />
                  <QuickAmountButton label="Max" disabled={!walletAddress || walletUsdcBalance <= 0} onClick={() => setQuickAmount(walletUsdcBalance)} />
                </div>
                <PreviewBox
                  rows={[
                    ["Selected APY", formatPercent(effectiveDepositApy)],
                    ["Estimated monthly", `${formatAmount(estimate.monthlyRewards)} ${ARC_POOL_TOKEN_SYMBOL}`],
                    ["Unlock", selectedLockDays > 0 ? getFutureDate(selectedLockDays) : "Withdraw anytime"]
                  ]}
                />
                {depositTooHigh && <AlertText>Insufficient {ARC_POOL_TOKEN_SYMBOL} balance.</AlertText>}
                {strategyMismatch && (
                  <AlertText>
                    Active position is {activePositionStrategy}. This contract supports one merged strategy per wallet, so choose {activePositionStrategy} to top up or withdraw after unlock to switch.
                  </AlertText>
                )}
                <Button className="h-10 w-full" onClick={() => void sendPoolTransaction("deposit")} disabled={finalDepositDisabled}>
                  <ArrowDownToLine className="h-4 w-4" />
                  Deposit
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <PreviewBox
                  rows={[
                    ["Staked", `${formatAmount(position.principal)} ${ARC_POOL_TOKEN_SYMBOL}`],
                    ["Claimable", `${formatAmount(positionRewards)} ${ARC_POOL_TOKEN_SYMBOL}`],
                    ["Unlock", positionLocked ? formatUnlock(positionUnlockAt) : "Available"]
                  ]}
                />
                <label className="block space-y-2 text-sm">
                  <span className="text-muted-foreground">Withdraw amount ({ARC_POOL_TOKEN_SYMBOL})</span>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0.00"
                    value={withdrawAmount}
                    onChange={(event) => {
                      setWithdrawAmount(event.target.value);
                      setWalletError(null);
                    }}
                    className="h-10 text-base"
                  />
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <QuickAmountButton label="25%" disabled={!walletAddress || position.principal <= 0} onClick={() => setQuickWithdrawAmount(position.principal * 0.25)} />
                  <QuickAmountButton label="50%" disabled={!walletAddress || position.principal <= 0} onClick={() => setQuickWithdrawAmount(position.principal * 0.5)} />
                  <QuickAmountButton label="75%" disabled={!walletAddress || position.principal <= 0} onClick={() => setQuickWithdrawAmount(position.principal * 0.75)} />
                  <QuickAmountButton label="Max" disabled={!walletAddress || position.principal <= 0} onClick={() => setQuickWithdrawAmount(position.principal)} />
                </div>
                {withdrawTooHigh && <AlertText>Insufficient staked {ARC_POOL_TOKEN_SYMBOL} balance.</AlertText>}
                <Button className="h-10 w-full" onClick={() => void sendPoolTransaction("withdraw")} disabled={withdrawDisabled}>
                  <ArrowUpFromLine className="h-4 w-4" />
                  Withdraw
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => void sendPoolTransaction("claim")} disabled={!walletAddress || positionAutoCompound}>
                    <Gift className="h-4 w-4" />
                    Claim
                  </Button>
                  <Button variant="outline" onClick={() => {
                    void refreshWalletBalance();
                    void refreshPoolPosition();
                    void refreshPoolBalance();
                  }} disabled={!walletAddress}>
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </div>
            )}

            {walletError && <AlertText>{walletError}</AlertText>}
            {actionMessage && <p className="mt-3 overflow-hidden break-words rounded-md border border-primary/20 bg-primary/10 p-2 text-xs text-primary">{actionMessage}</p>}
          </Panel>
        </aside>

        <section className="space-y-3 overflow-hidden">
          <div className="grid gap-3 md:grid-cols-4">
            <StatCard label="Effective APY" value={formatPercent(effectiveDepositApy)} icon={<Sparkles className="h-4 w-4" />} />
            <StatCard label="Pool balance" value={`${formatAmount(poolTvl)} ${ARC_POOL_TOKEN_SYMBOL}`} icon={<Activity className="h-4 w-4" />} />
            <StatCard label="Reward reserve" value={`${formatAmount(rewardReserve)} ${ARC_POOL_TOKEN_SYMBOL}`} icon={<Gift className="h-4 w-4" />} />
            <StatCard label="Pool health" value={poolHealth.label} tone={poolHealth.tone} icon={<ShieldCheck className="h-4 w-4" />} />
          </div>

          <Panel>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Your position</h2>
                <p className="text-sm text-muted-foreground">Track stake, rewards, unlock status, and projected income.</p>
              </div>
              <span className="rounded-md border border-border bg-secondary px-3 py-1 text-xs font-semibold">
                {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Not connected"}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <HeroMetric label="Active strategy" value={activePositionStrategy} />
              <HeroMetric label="Amount staked" value={`${formatAmount(position.principal)} ${ARC_POOL_TOKEN_SYMBOL}`} />
              <HeroMetric label="Pending rewards" value={`${formatAmount(positionRewards)} ${ARC_POOL_TOKEN_SYMBOL}`} />
              <HeroMetric label="Current APY" value={formatPercent(position.apy)} />
            </div>
            <div className="mt-3 rounded-md border border-border bg-background/40 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Strategy timeline</div>
                  <div className="text-xs text-muted-foreground">{timelineLabel}</div>
                </div>
                <Lock className="h-4 w-4 text-primary" />
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className={selectedStrategyHasPosition ? "h-full rounded-full bg-primary transition-all" : "h-full rounded-full bg-muted transition-all"}
                  style={{ width: `${unlockProgress.percent}%` }}
                />
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px] text-muted-foreground">
                {timelineSteps.map((step) => <span key={step}>{step}</span>)}
              </div>
            </div>
          </Panel>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel>
              <SectionTitle icon={<Target className="h-4 w-4" />} title="Reward projection" />
              <div className="grid gap-3 sm:grid-cols-3">
                <DetailMetric label="Daily" value={`${formatAmount(position.dailyRewards)} ${ARC_POOL_TOKEN_SYMBOL}`} />
                <DetailMetric label="Monthly" value={`${formatAmount(position.monthlyRewards)} ${ARC_POOL_TOKEN_SYMBOL}`} />
                <DetailMetric label="Yearly" value={`${formatAmount(position.yearlyRewards)} ${ARC_POOL_TOKEN_SYMBOL}`} />
              </div>
            </Panel>

            <Panel>
              <SectionTitle icon={<Activity className="h-4 w-4" />} title="Pool transparency" />
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailMetric label="Total staked" value={`${formatAmount(totalPrincipal)} ${ARC_POOL_TOKEN_SYMBOL}`} />
                <DetailMetric label="Reward runway" value={runwayDays > 0 ? `${Math.floor(runwayDays).toLocaleString()} days` : "No active stake"} />
                <DetailMetric label="Yearly obligation" value={`${formatAmount(yearlyRewardObligation)} ${ARC_POOL_TOKEN_SYMBOL}`} />
                <DetailMetric label="Reserve coverage" value={totalPrincipal > 0 ? `${(rewardReserve / Math.max(yearlyRewardObligation, 1)).toFixed(2)}x` : "Ready"} />
              </div>
            </Panel>
          </div>

          <Panel>
            <SectionTitle icon={<Activity className="h-4 w-4" />} title="Recent activity" />
            <div className="grid gap-2 lg:grid-cols-3">
              <ActivityRow title={actionMessage ?? "No transaction in this session yet"} detail={actionMessage ? "Latest wallet action submitted from this dashboard." : "Connect your wallet and deposit to start building activity."} active={Boolean(actionMessage)} />
              <ActivityRow title="Pool health refreshed from Arc Testnet" detail={`${formatAmount(poolBalance)} ${ARC_POOL_TOKEN_SYMBOL} currently held by the pool contract.`} active />
              <ActivityRow title="Strategy selected" detail={`${selectedLock.label} with ${formatPercent(effectiveDepositApy)} effective APY.`} active />
            </div>
          </Panel>
        </section>

        <aside className="space-y-3 overflow-hidden">
          <Panel>
            <SectionTitle icon={<Sparkles className="h-4 w-4" />} title="Yield simulator" />
            <div className="rounded-md border border-border bg-background/40 p-3">
              <div className="text-xs text-muted-foreground">Deposit preview</div>
              <div className="mt-1 text-2xl font-semibold">{formatAmount(estimate.principal)} {ARC_POOL_TOKEN_SYMBOL}</div>
              <div className="mt-3 grid gap-2">
                <InfoLine label="Daily" value={`${formatAmount(estimate.dailyRewards)} ${ARC_POOL_TOKEN_SYMBOL}`} />
                <InfoLine label="Monthly" value={`${formatAmount(estimate.monthlyRewards)} ${ARC_POOL_TOKEN_SYMBOL}`} />
                <InfoLine label="Yearly" value={`${formatAmount(estimate.yearlyRewards)} ${ARC_POOL_TOKEN_SYMBOL}`} />
                <InfoLine label="Auto-compounded" value={`${formatAmount(compoundedYearlyRewards)} ${ARC_POOL_TOKEN_SYMBOL}`} />
              </div>
            </div>
          </Panel>

          <Panel>
            <SectionTitle icon={<ShieldCheck className="h-4 w-4" />} title="Pool health" />
            <div className="flex items-center gap-3">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                <div className="text-center">
                  <div className={`text-lg font-semibold ${getToneTextClass(poolHealth.tone)}`}>{poolHealth.label}</div>
                  <div className="text-[11px] text-muted-foreground">status</div>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <InfoLine label="Reserve" value={`${formatAmount(rewardReserve)} ${ARC_POOL_TOKEN_SYMBOL}`} />
                <InfoLine label="Runway" value={runwayDays > 0 ? `${Math.floor(runwayDays)} days` : "Ready"} />
                <InfoLine label="Deposits" value={`${formatAmount(totalPrincipal)} ${ARC_POOL_TOKEN_SYMBOL}`} />
              </div>
            </div>
            {contractUrl && (
              <a href={contractUrl} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-between rounded-md border border-border bg-background/40 p-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
                View pool contract
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </Panel>

          <Panel>
            <SectionTitle icon={<CheckCircle2 className="h-4 w-4" />} title="Achievements" />
            <div className="grid gap-2">
              <Achievement label="First deposit" active={position.principal > 0} />
              <Achievement label="Auto-compounder" active={positionAutoCompound || autoCompound} />
              <Achievement label="Early pool user" active={walletAddress !== null} />
              <Achievement label="30-day maximizer" active={hasActivePosition && activePositionLockDays === 30} />
            </div>
          </Panel>
        </aside>
      </div>
    </main>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <Card className="border-border/80 bg-card/95 shadow-none">
      <CardContent className="p-3">{children}</CardContent>
    </Card>
  );
}

function HalcyonMark() {
  return (
    <svg viewBox="0 0 40 40" className="h-7 w-7" role="img" aria-label="Halcyon logo">
      <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="2.2" opacity="0.9" />
      <path d="M9 21.2h22" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.95" />
      <path d="M12 25.8c4.8-2.2 11.2-2.2 16 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
      <path d="M15.2 30c3-1.2 6.6-1.2 9.6 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
      <path d="M14.2 16.5a5.8 5.8 0 0 1 11.6 0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.95" />
    </svg>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2 flex justify-between gap-3 last:mb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words text-right font-medium">{value}</span>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-base font-semibold">
      <span className="text-primary">{icon}</span>
      {title}
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active
        ? "h-8 rounded-md bg-primary text-sm font-semibold text-primary-foreground"
        : "h-8 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"}
    >
      {children}
    </button>
  );
}

function StrategyCard({
  active,
  label,
  apy,
  description,
  activeStakeAmount,
  onClick
}: {
  active: boolean;
  label: string;
  apy: number;
  description: string;
  activeStakeAmount: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active
        ? "w-full rounded-md border border-primary bg-primary/10 p-2.5 text-left"
        : "w-full rounded-md border border-border bg-background/40 p-2.5 text-left transition-colors hover:border-primary/50 hover:bg-secondary/80"}
    >
      <span className="flex items-start justify-between gap-3">
          <span>
            <span className="block text-sm font-semibold">{label}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
            {activeStakeAmount && (
              <span className="mt-2 inline-flex rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
                Active stake: {activeStakeAmount}
              </span>
            )}
          </span>
        <span className="rounded-md bg-secondary px-2 py-1 text-xs font-semibold text-primary">{formatPercent(apy)}</span>
      </span>
    </button>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone = "default"
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: "default" | "healthy" | "watch" | "low";
}) {
  return (
    <Card className="border-border/80 bg-card/95 shadow-none">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{label}</span>
          <span className={getToneTextClass(tone)}>{icon}</span>
        </div>
        <div className={`mt-2 text-xl font-semibold ${getToneTextClass(tone)}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}

function QuickAmountButton({
  label,
  disabled,
  onClick
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-9 rounded-md border border-border bg-background/40 text-xs font-semibold transition-colors hover:border-primary/50 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function PreviewBox({ rows }: { rows: [string, string][] }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-2.5 text-sm">
      {rows.map(([label, value]) => (
        <InfoLine key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function ActivityRow({ title, detail, active }: { title: string; detail: string; active: boolean }) {
  return (
    <div className="flex gap-2 rounded-md border border-border bg-background/40 p-2.5">
      <span className={active ? "mt-1 h-2 w-2 rounded-full bg-primary" : "mt-1 h-2 w-2 rounded-full bg-muted"} />
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">{detail}</span>
      </span>
    </div>
  );
}

function Achievement({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={active
      ? "flex items-center justify-between rounded-md border border-primary/40 bg-primary/10 p-2.5 text-sm"
      : "flex items-center justify-between rounded-md border border-border bg-background/40 p-2.5 text-sm text-muted-foreground"}
    >
      <span>{label}</span>
      <CheckCircle2 className={active ? "h-4 w-4 text-primary" : "h-4 w-4"} />
    </div>
  );
}

function AlertText({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{children}</p>
  );
}

function formatTokenAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "";
  return Number(value.toFixed(6)).toString();
}

function formatAmount(value: number) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 2 : 6
  }).format(value);
}

function formatUnlock(timestamp: number) {
  if (!timestamp) return "Available";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(timestamp * 1000));
}

function getFutureDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(date);
}

function getStrategyDescription(days: number) {
  if (days === 30) return "Higher APY for committed testnet depositors.";
  if (days === 7) return "Short lock with a small yield boost.";
  return "Withdraw anytime, easiest way to test the pool.";
}

function getStrategyName(days: number) {
  return LOCK_OPTIONS.find((option) => option.days === days)?.label ?? "Unknown";
}

function inferPositionLockDays(updatedAt: number, unlockAt: number, positionApy: number) {
  if (!unlockAt) return 0;
  if (updatedAt > 0 && unlockAt > updatedAt) {
    const lockDays = Math.round((unlockAt - updatedAt) / 86400);
    if (lockDays >= 18) return 30;
    if (lockDays >= 3) return 7;
  }
  const matchedLock = LOCK_OPTIONS
    .filter((option) => option.days > 0)
    .find((option) => Math.abs(positionApy - (option.apy + ARC_EARLY_BOOST_APY)) < 0.25 || Math.abs(positionApy - option.apy) < 0.25);
  return matchedLock?.days ?? 0;
}

function getTimelineLabel(selectedLockDays: number, selectedStrategyHasPosition: boolean, positionLocked: boolean, unlockAt: number, daysLeft: number) {
  if (!selectedStrategyHasPosition) {
    if (selectedLockDays === 0) return "Flexible strategy: withdraw anytime after deposit";
    return `${selectedLockDays}-day strategy: unlocks ${selectedLockDays} days after deposit`;
  }
  if (positionLocked) return `${daysLeft} days left until unlock`;
  if (unlockAt > 0) return "Unlocked and ready to withdraw";
  return "Flexible position can withdraw anytime";
}

function getTimelineSteps(selectedLockDays: number) {
  if (selectedLockDays === 0) return ["Deposit", "Earning", "No lock", "Withdraw"];
  return ["Deposited", "Earning", `Day ${selectedLockDays}`, "Withdraw"];
}

function getUnlockProgress(unlockAt: number, lockDays: number) {
  const now = Math.floor(Date.now() / 1000);
  if (!unlockAt || lockDays <= 0 || unlockAt <= now) return { percent: unlockAt ? 100 : 0, daysLeft: 0 };
  const total = lockDays * 24 * 60 * 60;
  const remaining = Math.max(0, unlockAt - now);
  const percent = Math.min(100, Math.max(0, ((total - remaining) / total) * 100));
  return { percent, daysLeft: Math.ceil(remaining / 86400) };
}

function getPoolHealth(runwayDays: number, rewardReserve: number, totalPrincipal: number) {
  if (totalPrincipal <= 0) return { label: "Ready", tone: "default" as const };
  if (rewardReserve <= 0) return { label: "Critical", tone: "low" as const };
  if (runwayDays < 30) return { label: "Low", tone: "low" as const };
  if (runwayDays < 90) return { label: "Watch", tone: "watch" as const };
  return { label: "Strong", tone: "healthy" as const };
}

function getToneTextClass(tone: "default" | "healthy" | "watch" | "low") {
  if (tone === "healthy") return "text-primary";
  if (tone === "watch") return "text-accent";
  if (tone === "low") return "text-destructive";
  return "";
}
