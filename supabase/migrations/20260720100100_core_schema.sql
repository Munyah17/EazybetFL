-- =====================================================================
-- EazyBet core schema
-- =====================================================================

-- ---------- Enums ----------------------------------------------------
create type user_role as enum ('user','admin','super_admin');
create type account_status as enum ('active','suspended','banned');

create type wallet_tx_type as enum (
  'deposit','withdrawal','bet_stake','bet_payout','bet_refund',
  'bonus_credit','bonus_debit','cashout','adjustment','booking_release'
);
create type wallet_tx_status as enum ('pending','completed','failed','reversed');

create type payment_method as enum (
  'ecocash','onemoney','innbucks','omari','mukuru','visa','mastercard','bank_transfer'
);
create type deposit_status as enum ('pending','processing','completed','failed','cancelled');
create type withdrawal_status as enum ('pending','approved','processing','completed','rejected','failed');

create type fixture_status as enum ('upcoming','live','finished','cancelled','postponed');
create type market_status as enum ('open','suspended','closed');

create type bet_type as enum ('single','multiple','system');
create type bet_status as enum ('open','won','lost','void','cashed_out','partially_cashed_out');
create type selection_status as enum ('pending','won','lost','void');
create type booked_bet_status as enum ('active','loaded','expired','cancelled');

create type promo_type as enum ('welcome_bonus','deposit_bonus','free_bet','odds_boost','cashback');
create type bonus_status as enum ('active','completed','expired','forfeited');

create type casino_mode as enum ('demo','real');

create type notification_type as enum (
  'bet_won','bet_lost','bet_settled','deposit','withdrawal','bonus','promo','system'
);

-- ---------- Profiles ---------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique,
  phone text unique,
  avatar_url text,
  role user_role not null default 'user',
  status account_status not null default 'active',
  date_of_birth date,
  country text default 'ZW',
  referral_code text unique,
  referred_by uuid references public.profiles(id),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_profiles_role on public.profiles(role);
create index idx_profiles_phone on public.profiles(phone);

-- ---------- Wallets & Ledger -------------------------------------------
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  currency text not null default 'USD',
  balance numeric(14,2) not null default 0 check (balance >= 0),
  bonus_balance numeric(14,2) not null default 0 check (bonus_balance >= 0),
  locked_balance numeric(14,2) not null default 0 check (locked_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type wallet_tx_type not null,
  status wallet_tx_status not null default 'completed',
  amount numeric(14,2) not null,
  balance_before numeric(14,2) not null,
  balance_after numeric(14,2) not null,
  reference_type text,
  reference_id uuid,
  description text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index idx_wallet_tx_user on public.wallet_transactions(user_id, created_at desc);
create index idx_wallet_tx_reference on public.wallet_transactions(reference_type, reference_id);

-- ---------- Deposits & Withdrawals --------------------------------------
create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id),
  method payment_method not null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'USD',
  status deposit_status not null default 'pending',
  phone_number text,
  paynow_reference text,
  paynow_poll_url text,
  provider_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index idx_deposits_user on public.deposits(user_id, created_at desc);
create index idx_deposits_reference on public.deposits(paynow_reference);

create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id),
  method payment_method not null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'USD',
  status withdrawal_status not null default 'pending',
  destination jsonb not null,
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  provider_reference text,
  completed_at timestamptz
);
create index idx_withdrawals_user on public.withdrawals(user_id, requested_at desc);
create index idx_withdrawals_status on public.withdrawals(status);

-- ---------- Sportsbook: sport groups / competitions / fixtures ---------
create table public.sport_groups (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  icon text,
  display_order int not null default 0,
  active boolean not null default true
);

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  sport_group_id uuid not null references public.sport_groups(id) on delete cascade,
  odds_api_key text not null unique,
  title text not null,
  region text,
  active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_competitions_group on public.competitions(sport_group_id);

create table public.fixtures (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  odds_api_event_id text unique,
  home_team text not null,
  away_team text not null,
  commence_time timestamptz not null,
  status fixture_status not null default 'upcoming',
  home_score int,
  away_score int,
  minute int,
  is_featured boolean not null default false,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_fixtures_competition on public.fixtures(competition_id, commence_time);
create index idx_fixtures_status on public.fixtures(status, commence_time);
create index idx_fixtures_commence on public.fixtures(commence_time);

create table public.markets (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  market_key text not null,
  market_name text not null,
  status market_status not null default 'open',
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fixture_id, market_key)
);
create index idx_markets_fixture on public.markets(fixture_id);

create table public.odds_outcomes (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  bookmaker text not null default 'eazybet',
  name text not null,
  point numeric(6,2),
  price numeric(8,3) not null check (price > 1),
  display_order int not null default 0,
  updated_at timestamptz not null default now()
);
create index idx_odds_outcomes_market on public.odds_outcomes(market_id);

-- ---------- Bets ---------------------------------------------------------
create table public.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id),
  placement_group_id uuid not null default gen_random_uuid(),
  bet_type bet_type not null,
  system_size int,
  stake numeric(14,2) not null check (stake > 0),
  total_odds numeric(10,3) not null,
  base_total_odds numeric(10,3) not null,
  winboost_enabled boolean not null default false,
  winboost_pct numeric(5,2) not null default 0,
  potential_payout numeric(14,2) not null,
  status bet_status not null default 'open',
  cash_out_value numeric(14,2),
  is_free_bet boolean not null default false,
  placed_at timestamptz not null default now(),
  settled_at timestamptz,
  cashed_out_at timestamptz
);
create index idx_bets_placement_group on public.bets(placement_group_id);
create index idx_bets_user on public.bets(user_id, placed_at desc);
create index idx_bets_status on public.bets(status);

create table public.bet_selections (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references public.bets(id) on delete cascade,
  fixture_id uuid not null references public.fixtures(id),
  market_id uuid not null references public.markets(id),
  outcome_id uuid not null references public.odds_outcomes(id),
  selection_name text not null,
  market_name text not null,
  fixture_label text not null,
  odds_price numeric(8,3) not null,
  status selection_status not null default 'pending',
  settled_at timestamptz
);
create index idx_bet_selections_bet on public.bet_selections(bet_id);
create index idx_bet_selections_fixture on public.bet_selections(fixture_id, status);

create table public.booked_bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  bet_code text not null unique,
  bet_type bet_type not null,
  selections jsonb not null,
  total_odds numeric(10,3) not null,
  status booked_bet_status not null default 'active',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  loaded_at timestamptz,
  load_count int not null default 0
);
create index idx_booked_bets_user on public.booked_bets(user_id, created_at desc);
create index idx_booked_bets_code on public.booked_bets(bet_code);

-- ---------- Promotions & Bonuses -----------------------------------------
create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  type promo_type not null,
  value numeric(10,2),
  min_odds numeric(6,2),
  min_selections int,
  wagering_requirement numeric(5,2) default 1,
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  terms text,
  banner_url text,
  created_at timestamptz not null default now()
);

create table public.user_bonuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  promotion_id uuid references public.promotions(id),
  amount numeric(14,2) not null,
  wagering_required numeric(14,2) not null default 0,
  wagering_progress numeric(14,2) not null default 0,
  status bonus_status not null default 'active',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_user_bonuses_user on public.user_bonuses(user_id);

-- ---------- Casino (Spineazy) ---------------------------------------------
create table public.casino_games (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'spineazy',
  game_key text not null unique,
  title text not null,
  category text,
  thumbnail_url text,
  rtp numeric(5,2),
  demo_available boolean not null default true,
  active boolean not null default true,
  display_order int not null default 0
);

create table public.casino_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid not null references public.casino_games(id),
  mode casino_mode not null,
  session_token text not null unique,
  balance_snapshot numeric(14,2),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- ---------- Notifications ---------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type notification_type not null,
  title text not null,
  message text not null,
  read boolean not null default false,
  reference_type text,
  reference_id uuid,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on public.notifications(user_id, read, created_at desc);

-- ---------- Audit logs ---------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  actor_role user_role,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index idx_audit_logs_actor on public.audit_logs(actor_id, created_at desc);
create index idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);

-- ---------- updated_at trigger helper ---------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_wallets_updated_at before update on public.wallets
  for each row execute function public.set_updated_at();
create trigger trg_deposits_updated_at before update on public.deposits
  for each row execute function public.set_updated_at();
create trigger trg_fixtures_updated_at before update on public.fixtures
  for each row execute function public.set_updated_at();
create trigger trg_markets_updated_at before update on public.markets
  for each row execute function public.set_updated_at();
