# Halcyon

Halcyon is a USDC-native pool dashboard built on Arc testnet.

The app is an independent project. Halcyon uses Arc as infrastructure and does not imply endorsement by Circle or Arc.

The app supports:

- Wallet connection
- Circle faucet link
- USDC (ARC) wallet balance checks
- Deposit and withdraw tabs
- Partial withdrawals
- 25%, 50%, 75%, and Max shortcuts
- Lock period APY tiers
- Auto-compound mode
- Early-user APY boost
- Top depositor bonus distribution from reward reserve
- Pool health meter
- Reward reserve and runway estimates
- Dark-mode dashboard UI
- Strategy cards
- Active strategy display
- Yield simulator
- Pool transparency panel
- Recent activity feed
- Achievement badges

## Pool Features

Lock options:

- Flexible: 5.0% APY
- 7 days: 5.5% APY
- 30 days: 6.5% APY

Boosts:

- Early-user boost: +0.5% APY
- Top depositor bonus: admin-distributed USDC (ARC) from reward reserve

Pool health:

- Reads USDC pool balance
- Reads total principal from the pool contract
- Calculates reward reserve
- Estimates yearly reward obligation
- Shows reward runway and health state

## Stack

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style components
- viem
- Arc testnet
- USDC (ARC)

## Local Setup

```bash
npm install
npm run dev
```

Create `.env.local` from `.env.example`.

## Environment Variables

```bash
NEXT_PUBLIC_ARC_CHAIN_NAME=Arc Testnet
NEXT_PUBLIC_ARC_CHAIN_ID=5042002
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_ARC_EXPLORER_URL=https://testnet.arcscan.app/
NEXT_PUBLIC_ARC_POOL_OWNER=Aetherion
NEXT_PUBLIC_ARC_POOL_CONTRACT_ADDRESS=
NEXT_PUBLIC_ARC_POOL_TOKEN_ADDRESS=0x3600000000000000000000000000000000000000
NEXT_PUBLIC_ARC_POOL_TOKEN_SYMBOL=USDC (ARC)
NEXT_PUBLIC_ARC_POOL_TOKEN_DECIMALS=6
NEXT_PUBLIC_ARC_POOL_APY=5
NEXT_PUBLIC_ARC_EARLY_BOOST_APY=0.5
```

## Contract Deployment

Deploy:

```text
contracts/ArcYieldPool.sol
```

Constructor argument:

```text
tokenAddress = 0x3600000000000000000000000000000000000000
```

After deploying, set:

```bash
NEXT_PUBLIC_ARC_POOL_CONTRACT_ADDRESS=your_v2_contract_address
```

Then redeploy the Vercel app.

Important: the current contract uses this deposit function signature:

```solidity
deposit(uint256 amount, uint256 lockDays, bool autoCompound)
```

Older contract addresses will not work with this frontend. Deploy the current contract before enabling the live app.

## Funding Rewards

The owner must fund reward reserve with USDC (ARC):

1. Approve the pool contract to spend USDC.
2. Call `fundRewards(amount)` on the pool contract.

USDC uses 6 decimals:

```text
20 USDC = 20000000
100 USDC = 100000000
```

Top depositor bonuses are distributed by the owner through:

```solidity
distributeBonus(address user, uint256 amount)
```

This function can only use available reward reserve.
