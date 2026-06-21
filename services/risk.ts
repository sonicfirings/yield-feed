import type { RiskFactor } from "@/lib/types";

export type RiskInput = {
  tvlUsd: number;
  protocolAgeDays: number;
  apy: number;
  apyMean30d?: number | null;
  apyPct1d?: number | null;
  apyPct7d?: number | null;
};

export type RiskResult = {
  riskScore: number;
  factors: RiskFactor[];
};

function impact(points: number): RiskFactor["impact"] {
  if (points <= 1) return "low";
  if (points <= 2) return "medium";
  return "high";
}

export function calculateRiskScore(input: RiskInput): RiskResult {
  let points = 1;
  const factors: RiskFactor[] = [];

  const tvlPenalty =
    input.tvlUsd >= 100_000_000 ? 0 :
    input.tvlUsd >= 25_000_000 ? 1 :
    input.tvlUsd >= 5_000_000 ? 2 : 3;
  points += tvlPenalty;
  factors.push({
    label: "TVL",
    value: `$${Math.round(input.tvlUsd).toLocaleString()}`,
    impact: impact(tvlPenalty),
    note: tvlPenalty === 0 ? "Large liquidity base lowers risk." : "Smaller liquidity base increases exit and utilization risk."
  });

  const agePenalty =
    input.protocolAgeDays >= 1095 ? 0 :
    input.protocolAgeDays >= 365 ? 1 :
    input.protocolAgeDays >= 120 ? 2 : 3;
  points += agePenalty;
  factors.push({
    label: "Protocol age",
    value: `${input.protocolAgeDays} days`,
    impact: impact(agePenalty),
    note: agePenalty === 0 ? "Long operating history improves confidence." : "Shorter operating history increases uncertainty."
  });

  const mean = input.apyMean30d ?? input.apy;
  const meanDeviation = Math.abs(input.apy - mean);
  const shortTermMove = Math.max(Math.abs(input.apyPct1d ?? 0), Math.abs(input.apyPct7d ?? 0));
  const volatilityPenalty =
    meanDeviation <= 1 && shortTermMove <= 1 ? 0 :
    meanDeviation <= 3 && shortTermMove <= 3 ? 1 :
    meanDeviation <= 7 && shortTermMove <= 7 ? 2 : 3;
  points += volatilityPenalty;
  factors.push({
    label: "APY volatility",
    value: `${shortTermMove.toFixed(2)}% recent move`,
    impact: impact(volatilityPenalty),
    note: volatilityPenalty === 0 ? "Yield has been relatively stable." : "Recent APY movement suggests less predictable returns."
  });

  const abnormalYieldPenalty =
    input.apy <= 10 ? 0 :
    input.apy <= 20 ? 1 :
    input.apy <= 40 ? 2 : 3;
  points += abnormalYieldPenalty;
  factors.push({
    label: "Abnormal yield",
    value: `${input.apy.toFixed(2)}% APY`,
    impact: impact(abnormalYieldPenalty),
    note: abnormalYieldPenalty === 0 ? "APY is inside a normal yield range." : "Unusually high APY may reflect incentives, utilization spikes, or hidden risk."
  });

  return {
    riskScore: Math.min(10, Math.max(1, points)),
    factors
  };
}
