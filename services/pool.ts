export const ARC_POOL_APY = Number(process.env.NEXT_PUBLIC_ARC_POOL_APY ?? 5);
export const ARC_POOL_OWNER = process.env.NEXT_PUBLIC_ARC_POOL_OWNER ?? "Pool admin";
export const ARC_POOL_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ARC_POOL_CONTRACT_ADDRESS ?? "";
export const ARC_POOL_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_ARC_POOL_TOKEN_ADDRESS ?? "";
export const ARC_POOL_TOKEN_SYMBOL = process.env.NEXT_PUBLIC_ARC_POOL_TOKEN_SYMBOL ?? "USDC (ARC)";
export const ARC_POOL_TOKEN_DECIMALS = Number(process.env.NEXT_PUBLIC_ARC_POOL_TOKEN_DECIMALS ?? 6);
export const ARC_EARLY_BOOST_APY = Number(process.env.NEXT_PUBLIC_ARC_EARLY_BOOST_APY ?? 0.5);

export type LockOption = {
  label: string;
  days: number;
  apy: number;
};

export const LOCK_OPTIONS: LockOption[] = [
  { label: "Flexible", days: 0, apy: 5 },
  { label: "7 days", days: 7, apy: 5.5 },
  { label: "30 days", days: 30, apy: 6.5 }
];

export const ARC_YIELD_POOL_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "lockDays", type: "uint256" },
      { name: "autoCompound", type: "bool" }
    ],
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
      { name: "updatedAt", type: "uint256" },
      { name: "unlockAt", type: "uint256" },
      { name: "apyBps", type: "uint256" },
      { name: "autoCompound", type: "bool" },
      { name: "boostBps", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "pendingRewards",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "rewards", type: "uint256" }]
  },
  {
    type: "function",
    name: "totalPrincipal",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "totalPrincipal", type: "uint256" }]
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
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }]
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

export function compoundedYearlyReturn(principal: number, apy: number) {
  if (!Number.isFinite(principal) || principal <= 0) return 0;
  return Number((principal * ((1 + apy / 100 / 365) ** 365 - 1)).toFixed(6));
}

export function isPoolContractConfigured() {
  return Boolean(ARC_POOL_CONTRACT_ADDRESS);
}
