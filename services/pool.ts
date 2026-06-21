export const ARC_POOL_APY = Number(process.env.NEXT_PUBLIC_ARC_POOL_APY ?? 5);
export const ARC_POOL_OWNER = process.env.NEXT_PUBLIC_ARC_POOL_OWNER ?? "Pool admin";
export const ARC_POOL_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ARC_POOL_CONTRACT_ADDRESS ?? "";
export const ARC_POOL_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_ARC_POOL_TOKEN_ADDRESS ?? "";
export const ARC_POOL_TOKEN_SYMBOL = process.env.NEXT_PUBLIC_ARC_POOL_TOKEN_SYMBOL ?? "USDC (ARC)";
export const ARC_POOL_TOKEN_DECIMALS = Number(process.env.NEXT_PUBLIC_ARC_POOL_TOKEN_DECIMALS ?? 6);

export const ARC_YIELD_POOL_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
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
  }
] as const;

export const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "success", type: "bool" }]
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
