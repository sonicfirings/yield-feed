export const ARC_POOL_APY = Number(process.env.NEXT_PUBLIC_ARC_POOL_APY ?? 5);
export const ARC_POOL_OWNER = process.env.NEXT_PUBLIC_ARC_POOL_OWNER ?? "Pool admin";
export const ARC_POOL_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ARC_POOL_CONTRACT_ADDRESS ?? "";
export const ARC_POOL_TOKEN_SYMBOL = process.env.NEXT_PUBLIC_ARC_POOL_TOKEN_SYMBOL ?? "ARC";

export const ARC_YIELD_POOL_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "payable",
    inputs: [],
    outputs: []
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "claimRewards",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: []
  },
  {
    type: "function",
    name: "positions",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "principal", type: "uint256" },
      { name: "rewardDebt", type: "uint256" },
      { name: "updatedAt", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "pendingRewards",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "rewards", type: "uint256" }]
  }
] as const;

export type PoolEstimate = {
  principal: number;
  apy: number;
  dailyRewards: number;
  monthlyRewards: number;
  yearlyRewards: number;
  totalAfterYear: number;
};

export function estimateRewards(principal: number, apy = ARC_POOL_APY): PoolEstimate {
  const safePrincipal = Number.isFinite(principal) ? Math.max(principal, 0) : 0;
  const yearlyRewards = safePrincipal * (apy / 100);

  return {
    principal: safePrincipal,
    apy,
    dailyRewards: Number((yearlyRewards / 365).toFixed(6)),
    monthlyRewards: Number((yearlyRewards / 12).toFixed(6)),
    yearlyRewards: Number(yearlyRewards.toFixed(6)),
    totalAfterYear: Number((safePrincipal + yearlyRewards).toFixed(6))
  };
}

export function isPoolContractConfigured() {
  return Boolean(ARC_POOL_CONTRACT_ADDRESS);
}
