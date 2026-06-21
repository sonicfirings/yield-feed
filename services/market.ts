import type { MarketContext } from "@/lib/types";

const fallbackMarketContext: MarketContext = {
  bitcoinUsd: 65000,
  bitcoin24hChange: 0,
  ethereumUsd: 3500,
  ethereum24hChange: 0,
  source: "fallback",
  updatedAt: new Date().toISOString()
};

export async function getMarketContext(): Promise<MarketContext> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true",
      { next: { revalidate: 60 * 10 }, headers: { accept: "application/json" } }
    );
    if (!response.ok) throw new Error(`CoinGecko returned ${response.status}`);
    const body = await response.json();
    return {
      bitcoinUsd: Number(body.bitcoin.usd),
      bitcoin24hChange: Number(body.bitcoin.usd_24h_change ?? 0),
      ethereumUsd: Number(body.ethereum.usd),
      ethereum24hChange: Number(body.ethereum.usd_24h_change ?? 0),
      source: "coingecko",
      updatedAt: new Date().toISOString()
    };
  } catch {
    return fallbackMarketContext;
  }
}
