import type { Opportunity } from "@/lib/types";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fallbackOpportunities } from "@/services/mock-data";
import { calculateRiskScore } from "@/services/risk";
import { calculateRiskAdjustedReturn, enrichReturns, rankOpportunities } from "@/services/ranking";
import { isArcTestnetChain } from "@/services/arc";

type DefiLlamaPool = {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyMean30d?: number;
  apyPct1D?: number;
  apyPct7D?: number;
  exposure?: string;
};

const PROTOCOL_AGE_DAYS: Record<string, number> = {
  aave: 2300,
  compound: 2500,
  curve: 2300,
  maker: 3000,
  morpho: 760,
  venus: 1900,
  yearn: 2200,
  convex: 1800,
  spark: 1100,
  beefy: 2100
};

function protocolAgeDays(protocol: string) {
  const key = Object.keys(PROTOCOL_AGE_DAYS).find((name) => protocol.toLowerCase().includes(name));
  return key ? PROTOCOL_AGE_DAYS[key] : 365;
}

function normalizePool(pool: DefiLlamaPool): Opportunity {
  const risk = calculateRiskScore({
    tvlUsd: pool.tvlUsd,
    protocolAgeDays: protocolAgeDays(pool.project),
    apy: pool.apy,
    apyMean30d: pool.apyMean30d,
    apyPct1d: pool.apyPct1D,
    apyPct7d: pool.apyPct7D
  });

  return enrichReturns({
    id: pool.pool,
    poolId: pool.pool,
    protocol: pool.project,
    asset: pool.symbol,
    chain: pool.chain,
    apy: Number(pool.apy.toFixed(2)),
    tvlUsd: Math.round(pool.tvlUsd),
    protocolAgeDays: protocolAgeDays(pool.project),
    apyMean30d: Number((pool.apyMean30d ?? pool.apy).toFixed(2)),
    apyPct1d: pool.apyPct1D ?? null,
    apyPct7d: pool.apyPct7D ?? null,
    riskScore: risk.riskScore,
    riskAdjustedReturn: calculateRiskAdjustedReturn(pool.apy, risk.riskScore),
    estimatedMonthlyReturn: 0,
    estimatedYearlyReturn: 0,
    source: "defillama",
    updatedAt: new Date().toISOString(),
    riskFactors: risk.factors,
    stakeUrl: null
  });
}

async function fetchDefiLlamaPools(): Promise<Opportunity[]> {
  const response = await fetch("https://yields.llama.fi/pools", {
    next: { revalidate: 60 * 60 },
    headers: { accept: "application/json" }
  });
  if (!response.ok) throw new Error(`DeFiLlama returned ${response.status}`);

  const body = (await response.json()) as { data?: DefiLlamaPool[] };
  const pools = body.data ?? [];

  return pools
    .filter((pool) => Number.isFinite(pool.apy) && Number.isFinite(pool.tvlUsd))
    .filter((pool) => pool.tvlUsd >= 100_000)
    .filter((pool) => isArcTestnetChain(pool.chain))
    .map(normalizePool)
    .filter((opportunity) => opportunity.apy > 0)
    .slice(0, 80);
}

async function readCachedOpportunities(): Promise<Opportunity[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .order("risk_adjusted_return", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return data.map((row): Opportunity => ({
    id: row.id,
    poolId: row.pool_id,
    protocol: row.protocol,
    asset: row.asset,
    chain: row.chain,
    apy: Number(row.apy),
    tvlUsd: Number(row.tvl_usd),
    protocolAgeDays: Number(row.protocol_age_days ?? 365),
    apyMean30d: Number(row.apy_mean_30d ?? row.apy),
    apyPct1d: row.apy_pct_1d == null ? null : Number(row.apy_pct_1d),
    apyPct7d: row.apy_pct_7d == null ? null : Number(row.apy_pct_7d),
    riskScore: Number(row.risk_score),
    riskAdjustedReturn: Number(row.risk_adjusted_return),
    estimatedMonthlyReturn: Number(row.estimated_monthly_return ?? 0),
    estimatedYearlyReturn: Number(row.estimated_yearly_return ?? 0),
    source: "fallback" as const,
    updatedAt: row.updated_at,
    riskFactors: row.risk_factors ?? [],
    stakeUrl: row.stake_url ?? null
  })).filter((opportunity) => isArcTestnetChain(opportunity.chain));
}

async function cacheOpportunities(opportunities: Opportunity[]) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const rows = opportunities.map((opportunity) => ({
    id: opportunity.id,
    pool_id: opportunity.poolId,
    protocol: opportunity.protocol,
    asset: opportunity.asset,
    chain: opportunity.chain,
    apy: opportunity.apy,
    tvl_usd: opportunity.tvlUsd,
    protocol_age_days: opportunity.protocolAgeDays,
    apy_mean_30d: opportunity.apyMean30d,
    apy_pct_1d: opportunity.apyPct1d,
    apy_pct_7d: opportunity.apyPct7d,
    risk_score: opportunity.riskScore,
    risk_adjusted_return: opportunity.riskAdjustedReturn,
    estimated_monthly_return: opportunity.estimatedMonthlyReturn,
    estimated_yearly_return: opportunity.estimatedYearlyReturn,
    risk_factors: opportunity.riskFactors,
    stake_url: opportunity.stakeUrl,
    updated_at: opportunity.updatedAt
  }));

  await supabase.from("opportunities").upsert(rows, { onConflict: "id" });
  await supabase.from("opportunity_history").insert(
    rows.map((row) => ({
      opportunity_id: row.id,
      apy: row.apy,
      risk_score: row.risk_score,
      tvl_usd: row.tvl_usd
    }))
  );
}

export async function getOpportunities(): Promise<Opportunity[]> {
  try {
    const live = rankOpportunities(await fetchDefiLlamaPools()).slice(0, 50);
    if (live.length > 0) {
      await cacheOpportunities(live).catch(() => undefined);
      return live;
    }
  } catch {
    // Fall through to cache and ARC mock data.
  }

  const cached = await readCachedOpportunities();
  return cached.length > 0 ? rankOpportunities(cached) : rankOpportunities(fallbackOpportunities);
}
