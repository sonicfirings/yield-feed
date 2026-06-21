# ARC Yield Pool

ARC Yield Pool is a production-ready MVP for an owner-operated ARC testnet yield pool.

Users can connect a wallet, enter a deposit amount, and see every key number before staking:

- Amount staked
- Estimated APY
- Daily rewards
- Monthly rewards
- Yearly rewards
- Total estimated value after one year
- Accrued rewards estimate

The current UI is contract-ready. It runs in demo mode until you deploy a staking contract and add its address/ABI integration.

## Stack

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style components
- Supabase Postgres
- CoinGecko market context
- Injected browser wallet connection
- Optional DeFiLlama/Supabase data fallback
- Native ARC yield pool contract in `contracts/ArcYieldPool.sol`

## Local Setup

```bash
npm install
npm run dev
```

Create `.env.local` from `.env.example`.

## ARC Pool Configuration

```bash
NEXT_PUBLIC_ARC_CHAIN_NAME=ARC Testnet
NEXT_PUBLIC_ARC_CHAIN_ID=
NEXT_PUBLIC_ARC_RPC_URL=
NEXT_PUBLIC_ARC_EXPLORER_URL=
NEXT_PUBLIC_ARC_POOL_OWNER=
NEXT_PUBLIC_ARC_POOL_CONTRACT_ADDRESS=
NEXT_PUBLIC_ARC_POOL_TOKEN_SYMBOL=ARC
NEXT_PUBLIC_ARC_POOL_APY=5
```

The APY defaults to `5`. The app shows demo-mode calculations until `NEXT_PUBLIC_ARC_POOL_CONTRACT_ADDRESS` is set. Once set, the Deposit, Withdraw, and Claim Rewards buttons submit wallet transactions to the native ARC pool contract ABI in `services/pool.ts`.

## Smart Contract Model

Recommended structure:

- You own/admin the pool.
- Users deposit ARC testnet tokens into a smart contract.
- The contract records each wallet's principal.
- Rewards accrue according to contract rules.
- The pool owner/admin funds the reward reserve.
- Users can withdraw or claim according to the contract.

Do not ask users to send funds directly to a personal wallet. Use contract custody.

The included `contracts/ArcYieldPool.sol` contract supports:

- `deposit()` with native ARC value
- `withdraw(uint256 amount)`
- `claimRewards()`
- `fundRewards()` for the pool owner
- `setPaused(bool)` for the pool owner
- `pendingRewards(address user)`

After deploying it to ARC testnet, add the deployed address to:

```bash
NEXT_PUBLIC_ARC_POOL_CONTRACT_ADDRESS=
```

## Database

Run `supabase/schema.sql` in the Supabase SQL editor if you want watchlist/history persistence. Supabase is optional for the current pool dashboard.

## Vercel Deployment

1. Push the project to GitHub.
2. Import the repo in Vercel.
3. Add environment variables from `.env.example`.
4. Deploy.

No custom server is required.
