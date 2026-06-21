import type { Opportunity } from "@/lib/types";

export const fallbackOpportunities: Opportunity[] = [
  {
    id: "fallback-aave-usdc-arbitrum",
    poolId: "fallback-aave-usdc-arbitrum",
    protocol: "Aave V3",
    asset: "USDC",
    chain: "Arbitrum",
    apy: 5.84,
    tvlUsd: 126500000,
    protocolAgeDays: 2300,
    apyMean30d: 5.62,
    apyPct1d: 0.05,
    apyPct7d: 0.28,
    riskScore: 2,
    riskAdjustedReturn: 2.92,
    estimatedMonthlyReturn: 4.87,
    estimatedYearlyReturn: 58.4,
    source: "fallback",
    updatedAt: new Date().toISOString(),
    riskFactors: [
      { label: "TVL", value: "$126.5M", impact: "low", note: "Large liquidity base lowers pool risk." },
      { label: "Age", value: "2300 days", impact: "low", note: "Long operating history improves confidence." },
      { label: "Volatility", value: "0.28% 7d", impact: "low", note: "Recent APY movement is modest." }
    ]
  },
  {
    id: "fallback-compound-usdt-mainnet",
    poolId: "fallback-compound-usdt-mainnet",
    protocol: "Compound V3",
    asset: "USDT",
    chain: "Ethereum",
    apy: 4.91,
    tvlUsd: 88400000,
    protocolAgeDays: 2500,
    apyMean30d: 4.8,
    apyPct1d: 0.03,
    apyPct7d: 0.19,
    riskScore: 2,
    riskAdjustedReturn: 2.46,
    estimatedMonthlyReturn: 4.09,
    estimatedYearlyReturn: 49.1,
    source: "fallback",
    updatedAt: new Date().toISOString(),
    riskFactors: [
      { label: "TVL", value: "$88.4M", impact: "low", note: "Deep market liquidity." },
      { label: "Age", value: "2500 days", impact: "low", note: "Mature lending protocol." },
      { label: "Yield", value: "4.91%", impact: "low", note: "APY is within normal stablecoin ranges." }
    ]
  },
  {
    id: "fallback-morpho-usdc-base",
    poolId: "fallback-morpho-usdc-base",
    protocol: "Morpho",
    asset: "USDC",
    chain: "Base",
    apy: 9.7,
    tvlUsd: 34200000,
    protocolAgeDays: 760,
    apyMean30d: 8.9,
    apyPct1d: 0.42,
    apyPct7d: 1.36,
    riskScore: 4,
    riskAdjustedReturn: 2.43,
    estimatedMonthlyReturn: 8.08,
    estimatedYearlyReturn: 97,
    source: "fallback",
    updatedAt: new Date().toISOString(),
    riskFactors: [
      { label: "TVL", value: "$34.2M", impact: "medium", note: "Moderate liquidity." },
      { label: "Age", value: "760 days", impact: "medium", note: "Reasonable but shorter record." },
      { label: "Volatility", value: "1.36% 7d", impact: "medium", note: "APY has moved recently." }
    ]
  },
  {
    id: "fallback-curve-crvusd-mainnet",
    poolId: "fallback-curve-crvusd-mainnet",
    protocol: "Curve",
    asset: "crvUSD",
    chain: "Ethereum",
    apy: 13.4,
    tvlUsd: 19100000,
    protocolAgeDays: 2300,
    apyMean30d: 10.7,
    apyPct1d: 0.84,
    apyPct7d: 3.1,
    riskScore: 5,
    riskAdjustedReturn: 2.68,
    estimatedMonthlyReturn: 11.17,
    estimatedYearlyReturn: 134,
    source: "fallback",
    updatedAt: new Date().toISOString(),
    riskFactors: [
      { label: "Yield", value: "13.4%", impact: "medium", note: "Higher yield needs closer monitoring." },
      { label: "TVL", value: "$19.1M", impact: "medium", note: "Smaller pool than top lending markets." },
      { label: "Volatility", value: "3.10% 7d", impact: "high", note: "Recent APY changes are material." }
    ]
  },
  {
    id: "fallback-venus-usdt-bsc",
    poolId: "fallback-venus-usdt-bsc",
    protocol: "Venus",
    asset: "USDT",
    chain: "BSC",
    apy: 16.9,
    tvlUsd: 11800000,
    protocolAgeDays: 1900,
    apyMean30d: 12.4,
    apyPct1d: 1.2,
    apyPct7d: 4.4,
    riskScore: 6,
    riskAdjustedReturn: 2.82,
    estimatedMonthlyReturn: 14.08,
    estimatedYearlyReturn: 169,
    source: "fallback",
    updatedAt: new Date().toISOString(),
    riskFactors: [
      { label: "Yield", value: "16.9%", impact: "high", note: "Elevated APY raises abnormal-yield risk." },
      { label: "TVL", value: "$11.8M", impact: "medium", note: "Liquidity is thinner than safer markets." },
      { label: "Volatility", value: "4.40% 7d", impact: "high", note: "Yield is moving quickly." }
    ]
  }
];
