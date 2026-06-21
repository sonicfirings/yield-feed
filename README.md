# Yield Feed

Yield Feed is a production-ready MVP for ranking ARC testnet yield opportunities by risk-adjusted return.

## Stack

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style components
- Supabase Postgres
- DeFiLlama yield data
- CoinGecko market context
- Optional OpenAI explanations
- Injected browser wallet connection

## Local Setup

```bash
npm install
npm run dev
```

Create `.env.local` from `.env.example`.

Supabase is optional for local browsing. Without Supabase keys, the feed still works with live APIs and ARC testnet fallback data, while watchlist calls return local-only success responses.

ARC network configuration is controlled by:

```bash
NEXT_PUBLIC_ARC_CHAIN_NAME=ARC Testnet
NEXT_PUBLIC_ARC_CHAIN_ID=
NEXT_PUBLIC_ARC_RPC_URL=
NEXT_PUBLIC_ARC_EXPLORER_URL=
NEXT_PUBLIC_ARC_STAKE_URL=
```

Set `NEXT_PUBLIC_ARC_STAKE_URL` to the real staking app URL when ARC staking is available. The app appends `?pool=<poolId>` to that URL.

## Database

Run `supabase/schema.sql` in the Supabase SQL editor. It creates:

- `users`
- `opportunities`
- `watchlist`
- `opportunity_history`

The app stores DeFiLlama snapshots in `opportunities` and appends APY/risk/TVL snapshots to `opportunity_history`.

## API Routes

- `GET /api/opportunities` fetches ARC testnet DeFiLlama data, ranks it, includes CoinGecko market context, and falls back to cached or mock ARC data.
- `POST /api/risk` returns the risk score and factor breakdown for an input.
- `POST /api/ai-explain` explains a selected opportunity. It never performs calculations or invents new figures.
- `GET|POST|DELETE /api/watchlist` loads, saves, and removes watchlist items.

## Vercel Deployment

1. Push the project to a Git repository.
2. Import it in Vercel as a Next.js project.
3. Add environment variables from `.env.example`.
4. Deploy.

No custom server is required.

## Risk Model

`services/risk.ts` assigns a `riskScore` from 1 to 10 using:

- TVL size
- Protocol age
- APY volatility
- Abnormal yield detection

`services/ranking.ts` computes:

```ts
riskAdjustedReturn = apy / riskScore
```

The feed sorts highest risk-adjusted return first.

## Staking

The UI can connect to an injected wallet such as MetaMask. True direct staking requires protocol-specific contract addresses and ABIs. Until those are available, the production-safe action is to open the configured ARC staking URL for the selected pool.
