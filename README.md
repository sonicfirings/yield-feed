# Yield Feed

Yield Feed is a production-ready MVP for ranking stablecoin and crypto yield opportunities by risk-adjusted return.

## Stack

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style components
- Supabase Postgres
- DeFiLlama yield data
- CoinGecko market context
- Optional OpenAI explanations

## Local Setup

```bash
npm install
npm run dev
```

Create `.env.local` from `.env.example`.

Supabase is optional for local browsing. Without Supabase keys, the feed still works with live APIs and fallback data, while watchlist calls return local-only success responses.

## Database

Run `supabase/schema.sql` in the Supabase SQL editor. It creates:

- `users`
- `opportunities`
- `watchlist`
- `opportunity_history`

The app stores DeFiLlama snapshots in `opportunities` and appends APY/risk/TVL snapshots to `opportunity_history`.

## API Routes

- `GET /api/opportunities` fetches live DeFiLlama data, ranks it, includes CoinGecko market context, and falls back to cache/mock data.
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
