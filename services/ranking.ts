import type { Opportunity, PortfolioSimulation, RiskPreference } from "@/lib/types";

export function calculateRiskAdjustedReturn(apy: number, riskScore: number) {
  return Number((apy / Math.max(riskScore, 1)).toFixed(4));
}

export function enrichReturns(opportunity: Opportunity, capital = 1000): Opportunity {
  return {
    ...opportunity,
    riskAdjustedReturn: calculateRiskAdjustedReturn(opportunity.apy, opportunity.riskScore),
    estimatedMonthlyReturn: Number(((capital * opportunity.apy / 100) / 12).toFixed(2)),
    estimatedYearlyReturn: Number((capital * opportunity.apy / 100).toFixed(2))
  };
}

export function rankOpportunities(opportunities: Opportunity[]) {
  return [...opportunities].sort((a, b) => b.riskAdjustedReturn - a.riskAdjustedReturn);
}

export function simulatePortfolio(
  opportunities: Opportunity[],
  capital: number,
  riskPreference: RiskPreference
): PortfolioSimulation {
  const maxRisk = riskPreference === "low" ? 3 : riskPreference === "medium" ? 6 : 10;
  const candidates = rankOpportunities(opportunities)
    .filter((opportunity) => opportunity.riskScore <= maxRisk)
    .slice(0, 3);

  const weights = riskPreference === "low" ? [0.5, 0.3, 0.2] : riskPreference === "medium" ? [0.4, 0.35, 0.25] : [0.34, 0.33, 0.33];
  const allocations = candidates.map((opportunity, index) => {
    const weight = weights[index] ?? 0;
    const amount = Number((capital * weight).toFixed(2));
    return {
      opportunity,
      amount,
      weight,
      expectedMonthlyIncome: Number(((amount * opportunity.apy / 100) / 12).toFixed(2)),
      expectedYearlyIncome: Number((amount * opportunity.apy / 100).toFixed(2))
    };
  });

  const expectedYearlyIncome = allocations.reduce((sum, item) => sum + item.expectedYearlyIncome, 0);

  return {
    capital,
    riskPreference,
    expectedApy: capital > 0 ? Number(((expectedYearlyIncome / capital) * 100).toFixed(2)) : 0,
    expectedMonthlyIncome: Number((expectedYearlyIncome / 12).toFixed(2)),
    allocations
  };
}
