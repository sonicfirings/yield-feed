import type { Opportunity } from "@/lib/types";

export const fallbackOpportunities: Opportunity[] = [
  {
    id: "arc-testnet-usdc-vault",
    poolId: "arc-testnet-usdc-vault",
    protocol: "ARC USDC Vault",
    asset: "USDC",
    chain: "ARC Testnet",
    apy: 6.2,
    tvlUsd: 2400000,
    protocolAgeDays: 120,
    apyMean30d: 6.0,
    apyPct1d: 0.05,
    apyPct7d: 0.3,
    riskScore: 5,
    riskAdjustedReturn: 1.24,
    estimatedMonthlyReturn: 5.17,
    estimatedYearlyReturn: 62,
    source: "fallback",
    updatedAt: new Date().toISOString(),
    stakeUrl: null,
    riskFactors: [
      { label: "TVL", value: "$2.4M", impact: "high", note: "Testnet liquidity is limited and should be treated as experimental." },
      { label: "Age", value: "120 days", impact: "high", note: "Short operating history increases uncertainty." },
      { label: "Volatility", value: "0.30% 7d", impact: "low", note: "Recent APY movement is modest." }
    ]
  },
  {
    id: "arc-testnet-arc-staking",
    poolId: "arc-testnet-arc-staking",
    protocol: "ARC Staking",
    asset: "ARC",
    chain: "ARC Testnet",
    apy: 8.4,
    tvlUsd: 1800000,
    protocolAgeDays: 100,
    apyMean30d: 7.9,
    apyPct1d: 0.14,
    apyPct7d: 0.8,
    riskScore: 6,
    riskAdjustedReturn: 1.4,
    estimatedMonthlyReturn: 7,
    estimatedYearlyReturn: 84,
    source: "fallback",
    updatedAt: new Date().toISOString(),
    stakeUrl: null,
    riskFactors: [
      { label: "TVL", value: "$1.8M", impact: "high", note: "Testnet TVL is small and may move quickly." },
      { label: "Age", value: "100 days", impact: "high", note: "Short operating history increases uncertainty." },
      { label: "Yield", value: "8.40%", impact: "low", note: "APY is not abnormal, but the network is still testnet." }
    ]
  },
  {
    id: "arc-testnet-usdt-lending",
    poolId: "arc-testnet-usdt-lending",
    protocol: "ARC Lending",
    asset: "USDT",
    chain: "ARC Testnet",
    apy: 11.8,
    tvlUsd: 950000,
    protocolAgeDays: 75,
    apyMean30d: 9.6,
    apyPct1d: 0.42,
    apyPct7d: 2.1,
    riskScore: 8,
    riskAdjustedReturn: 1.48,
    estimatedMonthlyReturn: 9.83,
    estimatedYearlyReturn: 118,
    source: "fallback",
    updatedAt: new Date().toISOString(),
    stakeUrl: null,
    riskFactors: [
      { label: "TVL", value: "$950K", impact: "high", note: "TVL is below the normal production threshold." },
      { label: "Age", value: "75 days", impact: "high", note: "Very short operating history." },
      { label: "Volatility", value: "2.10% 7d", impact: "medium", note: "APY has moved recently." }
    ]
  }
];
