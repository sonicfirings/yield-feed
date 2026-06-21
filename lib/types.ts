export type RiskPreference = "low" | "medium" | "high";

export type Opportunity = {
  id: string;
  poolId: string;
  protocol: string;
  asset: string;
  chain: string;
  apy: number;
  tvlUsd: number;
  protocolAgeDays: number;
  apyMean30d: number;
  apyPct1d: number | null;
  apyPct7d: number | null;
  riskScore: number;
  riskAdjustedReturn: number;
  estimatedMonthlyReturn: number;
  estimatedYearlyReturn: number;
  source: "defillama" | "fallback";
  updatedAt: string;
  riskFactors: RiskFactor[];
};

export type RiskFactor = {
  label: string;
  value: string;
  impact: "low" | "medium" | "high";
  note: string;
};

export type FeedFilters = {
  riskLevel: "all" | "low" | "medium" | "high";
  chain: string;
  minApy: number;
};

export type PortfolioAllocation = {
  opportunity: Opportunity;
  amount: number;
  weight: number;
  expectedMonthlyIncome: number;
  expectedYearlyIncome: number;
};

export type PortfolioSimulation = {
  capital: number;
  riskPreference: RiskPreference;
  expectedApy: number;
  expectedMonthlyIncome: number;
  allocations: PortfolioAllocation[];
};

export type WatchlistItem = {
  id: string;
  userId: string;
  opportunityId: string;
  createdAt: string;
};

export type MarketContext = {
  bitcoinUsd: number;
  bitcoin24hChange: number;
  ethereumUsd: number;
  ethereum24hChange: number;
  source: "coingecko" | "fallback";
  updatedAt: string;
};
