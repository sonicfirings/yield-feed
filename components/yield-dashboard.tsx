"use client";

import { useEffect, useMemo, useState } from "react";
import { Bookmark, Bot, Calculator, ExternalLink, RefreshCw, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import type { FeedFilters, MarketContext, Opportunity, PortfolioSimulation, RiskPreference } from "@/lib/types";
import { formatCompactUsd, formatPercent, formatUsd } from "@/lib/utils";
import { simulatePortfolio } from "@/services/ranking";
import { ARC_TESTNET_CHAIN } from "@/services/arc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type AiExplanation = {
  explanation: string;
  risks: string[];
  suitableFor: string;
};

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function YieldDashboard({ initialOpportunities, initialMarketContext }: { initialOpportunities: Opportunity[]; initialMarketContext: MarketContext }) {
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [marketContext, setMarketContext] = useState(initialMarketContext);
  const [selectedId, setSelectedId] = useState(initialOpportunities[0]?.id);
  const [filters, setFilters] = useState<FeedFilters>({ riskLevel: "all", chain: "all", minApy: 0 });
  const [capital, setCapital] = useState(1000);
  const [riskPreference, setRiskPreference] = useState<RiskPreference>("medium");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [ai, setAi] = useState<AiExplanation | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);

  const chains = useMemo(() => ["all", ...Array.from(new Set(opportunities.map((item) => item.chain))).sort()], [opportunities]);

  const filtered = useMemo(() => {
    return opportunities.filter((item) => {
      const riskMatch =
        filters.riskLevel === "all" ||
        (filters.riskLevel === "low" && item.riskScore <= 3) ||
        (filters.riskLevel === "medium" && item.riskScore > 3 && item.riskScore <= 6) ||
        (filters.riskLevel === "high" && item.riskScore > 6);
      const chainMatch = filters.chain === "all" || item.chain === filters.chain;
      return riskMatch && chainMatch && item.apy >= filters.minApy;
    });
  }, [filters, opportunities]);

  const selected = opportunities.find((item) => item.id === selectedId) ?? filtered[0] ?? opportunities[0];
  const simulation = useMemo<PortfolioSimulation>(() => simulatePortfolio(filtered, capital, riskPreference), [capital, filtered, riskPreference]);

  useEffect(() => {
    fetch("/api/watchlist")
      .then((response) => response.json())
      .then((body) => {
        const ids = (body.watchlist ?? []).map((item: { opportunity_id: string }) => item.opportunity_id);
        setSavedIds(new Set(ids));
      })
      .catch(() => setSavedIds(new Set()));
  }, []);

  async function refreshFeed() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/opportunities", { cache: "no-store" });
      const body = await response.json();
      if (body.opportunities?.length) {
        setOpportunities(body.opportunities);
        if (body.marketContext) setMarketContext(body.marketContext);
        setSelectedId(body.opportunities[0].id);
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function toggleWatchlist(opportunityId: string) {
    const next = new Set(savedIds);
    const isSaved = next.has(opportunityId);
    isSaved ? next.delete(opportunityId) : next.add(opportunityId);
    setSavedIds(next);

    await fetch("/api/watchlist", {
      method: isSaved ? "DELETE" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ opportunityId })
    }).catch(() => undefined);
  }

  async function explainSelected() {
    if (!selected) return;
    setAiLoading(true);
    setAi(null);
    try {
      const response = await fetch("/api/ai-explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(selected)
      });
      const body = await response.json();
      setAi(response.ok ? body : { explanation: body.error ?? "Unable to explain this opportunity.", risks: [], suitableFor: "Review the risk breakdown above." });
    } finally {
      setAiLoading(false);
    }
  }

  function selectOpportunity(id: string) {
    setSelectedId(id);
    setAi(null);
  }

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
          nativeCurrency: { name: "ARC", symbol: "ARC", decimals: 18 }
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

  return (
    <main className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-5 py-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">Yield Feed</h1>
            <p className="text-sm text-muted-foreground">ARC testnet yield opportunities ranked by risk-adjusted return</p>
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
            <Button variant="outline" onClick={refreshFeed} disabled={refreshing}>
              <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 p-4 lg:grid-cols-[260px_minmax(0,1fr)_380px]">
        <aside className="space-y-4 rounded-lg border bg-card p-4 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <div>
            <h2 className="text-sm font-semibold">Filters</h2>
            <p className="text-xs text-muted-foreground">ARC testnet feed controls</p>
          </div>
          <label className="block space-y-2 text-sm">
            <span className="text-muted-foreground">Risk level</span>
            <Select value={filters.riskLevel} onChange={(event) => setFilters({ ...filters, riskLevel: event.target.value as FeedFilters["riskLevel"] })}>
              <option value="all">All risk levels</option>
              <option value="low">Low (1-3)</option>
              <option value="medium">Medium (4-6)</option>
              <option value="high">High (7-10)</option>
            </Select>
          </label>
          <label className="block space-y-2 text-sm">
            <span className="text-muted-foreground">Chain</span>
            <Select value={filters.chain} onChange={(event) => setFilters({ ...filters, chain: event.target.value })}>
              {chains.map((chain) => <option key={chain} value={chain}>{chain === "all" ? "ARC testnet only" : chain}</option>)}
            </Select>
          </label>
          {walletError && <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{walletError}</p>}
          <label className="block space-y-2 text-sm">
            <span className="text-muted-foreground">Minimum APY</span>
            <Input type="number" min={0} value={filters.minApy} onChange={(event) => setFilters({ ...filters, minApy: Number(event.target.value) })} />
          </label>

          <div className="border-t pt-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Calculator className="h-4 w-4" />
              Simulator
            </div>
            <label className="mb-3 block space-y-2 text-sm">
              <span className="text-muted-foreground">Capital</span>
              <Input type="number" min={1} value={capital} onChange={(event) => setCapital(Number(event.target.value))} />
            </label>
            <label className="block space-y-2 text-sm">
              <span className="text-muted-foreground">Risk preference</span>
              <Select value={riskPreference} onChange={(event) => setRiskPreference(event.target.value as RiskPreference)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </label>
          </div>
        </aside>

        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-lg font-semibold">Ranked Opportunities</h2>
              <p className="text-sm text-muted-foreground">{filtered.length} ARC testnet results sorted by risk-adjusted return</p>
            </div>
            <Badge>{opportunities[0]?.source === "defillama" ? "Live data" : "Fallback data"}</Badge>
          </div>

          {filtered.map((item, index) => (
            <Card key={item.id} className={selected?.id === item.id ? "border-primary" : ""}>
              <div
                className="block w-full cursor-pointer text-left"
                role="button"
                tabIndex={0}
                onClick={() => selectOpportunity(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") selectOpportunity(item.id);
                }}
              >
                <CardContent className="grid gap-4 p-4 md:grid-cols-[48px_1.2fr_repeat(5,minmax(80px,1fr))_44px] md:items-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-sm font-semibold">#{index + 1}</div>
                  <div>
                    <div className="font-semibold">{item.protocol}</div>
                    <div className="text-sm text-muted-foreground">{item.asset} | {item.chain}</div>
                  </div>
                  <Metric label="APY" value={formatPercent(item.apy)} strong />
                  <Metric label="TVL" value={formatCompactUsd(item.tvlUsd)} />
                  <Metric label="Risk" value={`${item.riskScore}/10`} />
                  <Metric label="Adj." value={item.riskAdjustedReturn.toFixed(2)} />
                  <Metric label="$1k yearly" value={formatUsd(item.estimatedYearlyReturn)} />
                  <Button
                    type="button"
                    variant={savedIds.has(item.id) ? "default" : "outline"}
                    size="icon"
                    onClick={(event) => {
                      event.stopPropagation();
                      void toggleWatchlist(item.id);
                    }}
                    aria-label="Toggle watchlist"
                  >
                    <Bookmark className="h-4 w-4" />
                  </Button>
                </CardContent>
              </div>
            </Card>
          ))}
        </section>

        <aside className="space-y-4 rounded-lg border bg-card p-4 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:overflow-auto">
          {selected && (
            <>
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{selected.protocol}</h2>
                    <p className="text-sm text-muted-foreground">{selected.asset} on {selected.chain}</p>
                  </div>
                  <Badge>Risk {selected.riskScore}/10</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Market context from {marketContext.source === "coingecko" ? "CoinGecko" : "fallback cache"}.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DetailMetric label="Monthly" value={formatUsd(selected.estimatedMonthlyReturn)} />
                <DetailMetric label="Yearly" value={formatUsd(selected.estimatedYearlyReturn)} />
                <DetailMetric label="APY" value={formatPercent(selected.apy)} />
                <DetailMetric label="Rank score" value={selected.riskAdjustedReturn.toFixed(2)} />
              </div>

              <section className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4" />
                  Risk Breakdown
                </div>
                {selected.riskFactors.map((factor) => (
                  <div key={factor.label} className="rounded-md border p-3">
                    <div className="flex justify-between gap-3 text-sm font-medium">
                      <span>{factor.label}</span>
                      <span>{factor.value}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{factor.note}</p>
                  </div>
                ))}
              </section>

              <section className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Wallet className="h-4 w-4" />
                  Stake
                </div>
                <div className="rounded-md border p-3 text-sm">
                  <p className="mb-3 text-xs text-muted-foreground">
                    Direct staking is available when the opportunity has a configured ARC staking URL.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={connectWallet}>
                      <Wallet className="h-4 w-4" />
                      {walletAddress ? "Wallet connected" : "Connect wallet"}
                    </Button>
                    <Button className="flex-1" disabled={!selected.stakeUrl} asChild={Boolean(selected.stakeUrl)}>
                      {selected.stakeUrl ? (
                        <a href={selected.stakeUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          Stake
                        </a>
                      ) : (
                        <span>Stake unavailable</span>
                      )}
                    </Button>
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <TrendingUp className="h-4 w-4" />
                  Portfolio Top 3
                </div>
                <div className="rounded-md border p-3 text-sm">
                  <div className="mb-2 flex justify-between">
                    <span className="text-muted-foreground">Expected APY</span>
                    <span className="font-semibold">{formatPercent(simulation.expectedApy)}</span>
                  </div>
                  <div className="mb-3 flex justify-between">
                    <span className="text-muted-foreground">Monthly income</span>
                    <span className="font-semibold">{formatUsd(simulation.expectedMonthlyIncome)}</span>
                  </div>
                  <div className="space-y-2">
                    {simulation.allocations.map((allocation) => (
                      <div key={allocation.opportunity.id} className="flex justify-between gap-3 text-xs">
                        <span>{allocation.opportunity.protocol} {allocation.opportunity.asset}</span>
                        <span>{formatUsd(allocation.amount)} | {(allocation.weight * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <Button className="w-full" onClick={explainSelected} disabled={aiLoading}>
                  <Bot className="h-4 w-4" />
                  {aiLoading ? "Explaining..." : "Explain with AI"}
                </Button>
                {ai && (
                  <div className="space-y-3 rounded-md border p-3 text-sm">
                    <p>{ai.explanation}</p>
                    <div>
                      <div className="font-medium">Risks</div>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
                        {ai.risks.map((risk) => <li key={risk}>{risk}</li>)}
                      </ul>
                    </div>
                    <div>
                      <div className="font-medium">Suitable for</div>
                      <p className="text-muted-foreground">{ai.suitableFor}</p>
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={strong ? "font-semibold text-primary" : "font-medium"}>{value}</div>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
