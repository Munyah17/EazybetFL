-- =====================================================================
-- Row Level Security
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.deposits enable row level security;
alter table public.withdrawals enable row level security;
alter table public.sport_groups enable row level security;
alter table public.competitions enable row level security;
alter table public.fixtures enable row level security;
alter table public.markets enable row level security;
alter table public.odds_outcomes enable row level security;
alter table public.bets enable row level security;
alter table public.bet_selections enable row level security;
alter table public.booked_bets enable row level security;
alter table public.promotions enable row level security;
alter table public.user_bonuses enable row level security;
alter table public.casino_games enable row level security;
alter table public.casino_sessions enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- Helper: is the current user an admin/super_admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','super_admin')
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

-- ---------- profiles ----------
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin());
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

-- ---------- wallets ----------
create policy "wallets_select_own_or_admin" on public.wallets
  for select using (user_id = auth.uid() or public.is_admin());

-- ---------- wallet_transactions ----------
create policy "wallet_tx_select_own_or_admin" on public.wallet_transactions
  for select using (user_id = auth.uid() or public.is_admin());

-- ---------- deposits ----------
create policy "deposits_select_own_or_admin" on public.deposits
  for select using (user_id = auth.uid() or public.is_admin());
create policy "deposits_insert_own" on public.deposits
  for insert with check (user_id = auth.uid());

-- ---------- withdrawals ----------
create policy "withdrawals_select_own_or_admin" on public.withdrawals
  for select using (user_id = auth.uid() or public.is_admin());
create policy "withdrawals_admin_update" on public.withdrawals
  for update using (public.is_admin());

-- ---------- sportsbook reference data: public read ----------
create policy "sport_groups_public_read" on public.sport_groups
  for select using (true);
create policy "competitions_public_read" on public.competitions
  for select using (true);
create policy "fixtures_public_read" on public.fixtures
  for select using (true);
create policy "markets_public_read" on public.markets
  for select using (true);
create policy "odds_outcomes_public_read" on public.odds_outcomes
  for select using (true);
create policy "sport_groups_admin_write" on public.sport_groups
  for all using (public.is_admin()) with check (public.is_admin());
create policy "competitions_admin_write" on public.competitions
  for all using (public.is_admin()) with check (public.is_admin());
create policy "fixtures_admin_write" on public.fixtures
  for all using (public.is_admin()) with check (public.is_admin());
create policy "markets_admin_write" on public.markets
  for all using (public.is_admin()) with check (public.is_admin());
create policy "odds_outcomes_admin_write" on public.odds_outcomes
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- bets ----------
create policy "bets_select_own_or_admin" on public.bets
  for select using (user_id = auth.uid() or public.is_admin());
create policy "bet_selections_select_own_or_admin" on public.bet_selections
  for select using (
    exists (select 1 from public.bets b where b.id = bet_id and (b.user_id = auth.uid() or public.is_admin()))
  );

-- ---------- booked bets: readable by owner; loadable by code via RPC (service role) ----------
create policy "booked_bets_select_own_or_admin" on public.booked_bets
  for select using (user_id = auth.uid() or public.is_admin());

-- ---------- promotions: public read of active ----------
create policy "promotions_public_read" on public.promotions
  for select using (active = true or public.is_admin());
create policy "promotions_admin_write" on public.promotions
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- user bonuses ----------
create policy "user_bonuses_select_own_or_admin" on public.user_bonuses
  for select using (user_id = auth.uid() or public.is_admin());

-- ---------- casino ----------
create policy "casino_games_public_read" on public.casino_games
  for select using (active = true or public.is_admin());
create policy "casino_games_admin_write" on public.casino_games
  for all using (public.is_admin()) with check (public.is_admin());
create policy "casino_sessions_select_own_or_admin" on public.casino_sessions
  for select using (user_id = auth.uid() or public.is_admin());

-- ---------- notifications ----------
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- audit logs: super admin only ----------
create policy "audit_logs_select_super_admin" on public.audit_logs
  for select using (public.is_super_admin());
