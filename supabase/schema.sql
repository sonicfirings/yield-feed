create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.opportunities (
  id text primary key,
  pool_id text not null,
  protocol text not null,
  asset text not null,
  chain text not null,
  apy numeric not null,
  tvl_usd numeric not null,
  protocol_age_days integer not null default 365,
  apy_mean_30d numeric,
  apy_pct_1d numeric,
  apy_pct_7d numeric,
  risk_score integer not null check (risk_score between 1 and 10),
  risk_adjusted_return numeric not null,
  estimated_monthly_return numeric,
  estimated_yearly_return numeric,
  risk_factors jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  opportunity_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, opportunity_id)
);

create table if not exists public.opportunity_history (
  id uuid primary key default gen_random_uuid(),
  opportunity_id text not null,
  apy numeric not null,
  risk_score integer not null check (risk_score between 1 and 10),
  tvl_usd numeric not null,
  captured_at timestamptz not null default now()
);

create index if not exists opportunities_rank_idx on public.opportunities (risk_adjusted_return desc);
create index if not exists history_opportunity_time_idx on public.opportunity_history (opportunity_id, captured_at desc);

insert into public.users (id, email)
values ('00000000-0000-0000-0000-000000000001', 'demo@yieldfeed.local')
on conflict (id) do nothing;
