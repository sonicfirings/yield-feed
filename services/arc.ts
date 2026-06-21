export const ARC_TESTNET_CHAIN = {
  name: process.env.NEXT_PUBLIC_ARC_CHAIN_NAME ?? "ARC Testnet",
  chainId: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID ?? 0),
  rpcUrl: process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "",
  explorerUrl: process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? ""
};

export function isArcTestnetChain(chain: string) {
  const normalized = chain.toLowerCase();
  return normalized.includes("arc") || normalized === ARC_TESTNET_CHAIN.name.toLowerCase();
}
