-- =====================================================================
-- Launch-day fixes bundle:
--
--  1. International phone numbers. fn_normalize_zw_phone only understood
--     Zimbabwean mobiles; fn_normalize_phone accepts any E.164-style
--     international number (+CC..., 00CC..., or a bare number long enough
--     to already carry a country code) while keeping every ZW input form
--     working identically. fn_lookup_email_by_phone now uses it, so
--     foreign-number accounts can sign in by phone too.
--
--  2. 'bonus' and 'voucher' wallet buckets. fn_wallet_credit/debit map
--     them: bonus -> bonus_balance, voucher -> principal_balance
--     (vouchers are bought with cash, so voucher money has deposit
--     semantics: bettable, not withdrawable). fn_wallet_debit_spend spends
--     principal, then bonus, then balance -- keeping withdrawable
--     winnings untouched for as long as possible.
--
--  3. fn_place_bet counts bonus_balance as spendable funds. The bonus
--     slice of a stake is recorded under stake_from_principal so refunds
--     and the stake portion of payouts return to principal (bet-only)
--     rather than converting bonus into withdrawable balance.
--
--  4. payment_method_settings: DB-backed on/off switches for deposit
--     rails, toggled from the super-admin portal. Seeded with Paynow on
--     and EcoCash Instant off.
--
--  5. fn_admin_manage_deposit: approve / reject / reverse / edit on
--     deposits for admin + super_admin, all through the same idempotent
--     wallet primitives the webhooks use.
--
--  6. RLS hardening: deposits_insert_own previously let any authenticated
--     user insert a deposit row in ANY status, including 'completed' --
--     cosmetic-only (crediting still requires fn_complete_deposit, which
--     is service-role) but it poisoned admin views. Inserts are now
--     limited to pending/processing.
-- =====================================================================

-- ---------- 1. international phone normalization ----------
create or replace function public.fn_normalize_phone(p_phone text)
returns text
language sql
immutable
as $$
  with raw as (
    select coalesce(p_phone, '') as s,
           regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d
  ),
  zw as (
    -- strip repeated 263 country codes, then the national trunk 0
    select regexp_replace(regexp_replace(d, '^(263)+', ''), '^0+', '') as tail
    from raw
  )
  select case
    -- Zimbabwean mobile: 9-digit subscriber number starting with 7
    when (select tail from zw) ~ '^7\d{8}$' then '+263' || (select tail from zw)
    -- Explicit international: "+CC..." or "00CC..."
    when (select s from raw) ~ '^\s*(\+|00)'
         and regexp_replace((select d from raw), '^0+', '') ~ '^[1-9]\d{6,14}$'
      then '+' || regexp_replace((select d from raw), '^0+', '')
    -- Bare digits long enough to already include a country code
    when (select d from raw) ~ '^[1-9]\d{9,14}$'
      then '+' || (select d from raw)
    else null
  end
$$;

grant execute on function public.fn_normalize_phone(text) to anon, authenticated;

create or replace function public.fn_lookup_email_by_phone(p_phone text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select email
  from public.profiles
  where phone is not null
    and public.fn_normalize_phone(p_phone) is not null
    and public.fn_normalize_phone(phone) = public.fn_normalize_phone(p_phone)
  order by (phone = p_phone) desc, created_at asc
  limit 1;
$$;

-- ---------- 2. wallet primitives with the new buckets ----------
create or replace function public.fn_wallet_credit(
  p_user_id uuid,
  p_amount numeric,
  p_type wallet_tx_type,
  p_reference_type text,
  p_reference_id uuid,
  p_description text,
  p_status wallet_tx_status default 'completed',
  p_created_by uuid default null,
  p_bucket wallet_bucket default 'balance'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.wallets%rowtype;
  v_tx_id uuid;
  v_before numeric;
  v_after numeric;
begin
  select * into v_wallet from public.wallets where user_id = p_user_id for update;
  if not found then
    raise exception 'WALLET_NOT_FOUND';
  end if;

  -- Bucket -> physical column:
  --   principal / voucher -> principal_balance (cash-backed, bet-only)
  --   bonus               -> bonus_balance     (house-funded, bet-only)
  --   balance             -> balance           (winnings, withdrawable)
  if p_bucket in ('principal', 'voucher') then
    v_before := v_wallet.principal_balance;
    update public.wallets set principal_balance = principal_balance + p_amount, updated_at = now()
      where user_id = p_user_id returning principal_balance into v_after;
  elsif p_bucket = 'bonus' then
    v_before := v_wallet.bonus_balance;
    update public.wallets set bonus_balance = bonus_balance + p_amount, updated_at = now()
      where user_id = p_user_id returning bonus_balance into v_after;
  else
    v_before := v_wallet.balance;
    update public.wallets set balance = balance + p_amount, updated_at = now()
      where user_id = p_user_id returning balance into v_after;
  end if;

  insert into public.wallet_transactions (
    wallet_id, user_id, type, status, amount, balance_before, balance_after,
    reference_type, reference_id, description, created_by, bucket
  ) values (
    v_wallet.id, p_user_id, p_type, p_status, p_amount, v_before, v_after,
    p_reference_type, p_reference_id, p_description, p_created_by, p_bucket
  ) returning id into v_tx_id;

  return v_tx_id;
end;
$$;

create or replace function public.fn_wallet_debit(
  p_user_id uuid,
  p_amount numeric,
  p_type wallet_tx_type,
  p_reference_type text,
  p_reference_id uuid,
  p_description text,
  p_status wallet_tx_status default 'completed',
  p_created_by uuid default null,
  p_bucket wallet_bucket default 'balance'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.wallets%rowtype;
  v_tx_id uuid;
  v_before numeric;
  v_after numeric;
begin
  select * into v_wallet from public.wallets where user_id = p_user_id for update;
  if not found then
    raise exception 'WALLET_NOT_FOUND';
  end if;

  if p_bucket in ('principal', 'voucher') then
    if v_wallet.principal_balance < p_amount then
      raise exception 'INSUFFICIENT_FUNDS';
    end if;
    v_before := v_wallet.principal_balance;
    update public.wallets set principal_balance = principal_balance - p_amount, updated_at = now()
      where user_id = p_user_id returning principal_balance into v_after;
  elsif p_bucket = 'bonus' then
    if v_wallet.bonus_balance < p_amount then
      raise exception 'INSUFFICIENT_FUNDS';
    end if;
    v_before := v_wallet.bonus_balance;
    update public.wallets set bonus_balance = bonus_balance - p_amount, updated_at = now()
      where user_id = p_user_id returning bonus_balance into v_after;
  else
    if v_wallet.balance < p_amount then
      raise exception 'INSUFFICIENT_FUNDS';
    end if;
    v_before := v_wallet.balance;
    update public.wallets set balance = balance - p_amount, updated_at = now()
      where user_id = p_user_id returning balance into v_after;
  end if;

  insert into public.wallet_transactions (
    wallet_id, user_id, type, status, amount, balance_before, balance_after,
    reference_type, reference_id, description, created_by, bucket
  ) values (
    v_wallet.id, p_user_id, p_type, p_status, -p_amount, v_before, v_after,
    p_reference_type, p_reference_id, p_description, p_created_by, p_bucket
  ) returning id into v_tx_id;

  return v_tx_id;
end;
$$;

-- Spend order: principal (deposits/vouchers) -> bonus -> balance (winnings).
-- Winnings are the only withdrawable funds, so they're spent last.
create or replace function public.fn_wallet_debit_spend(
  p_user_id uuid,
  p_amount numeric,
  p_type wallet_tx_type,
  p_reference_type text,
  p_reference_id uuid,
  p_description text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.wallets%rowtype;
  v_from_principal numeric;
  v_from_bonus numeric;
  v_from_balance numeric;
begin
  select * into v_wallet from public.wallets where user_id = p_user_id for update;
  if not found then
    raise exception 'WALLET_NOT_FOUND';
  end if;
  if v_wallet.principal_balance + v_wallet.bonus_balance + v_wallet.balance < p_amount then
    raise exception 'INSUFFICIENT_FUNDS';
  end if;

  v_from_principal := least(p_amount, v_wallet.principal_balance);
  v_from_bonus := least(p_amount - v_from_principal, v_wallet.bonus_balance);
  v_from_balance := p_amount - v_from_principal - v_from_bonus;

  if v_from_principal > 0 then
    perform public.fn_wallet_debit(
      p_user_id, v_from_principal, p_type, p_reference_type, p_reference_id, p_description,
      p_bucket := 'principal'
    );
  end if;
  if v_from_bonus > 0 then
    perform public.fn_wallet_debit(
      p_user_id, v_from_bonus, p_type, p_reference_type, p_reference_id, p_description,
      p_bucket := 'bonus'
    );
  end if;
  if v_from_balance > 0 then
    perform public.fn_wallet_debit(
      p_user_id, v_from_balance, p_type, p_reference_type, p_reference_id, p_description,
      p_bucket := 'balance'
    );
  end if;

  return jsonb_build_object(
    'from_principal', v_from_principal,
    'from_bonus', v_from_bonus,
    'from_balance', v_from_balance
  );
end;
$$;

revoke execute on function public.fn_wallet_debit_spend(uuid, numeric, wallet_tx_type, text, uuid, text) from public, anon, authenticated;
grant execute on function public.fn_wallet_debit_spend(uuid, numeric, wallet_tx_type, text, uuid, text) to service_role;

-- ---------- 3. fn_place_bet: bonus_balance counts as spendable ----------
-- Identical to 20261010090000's version except:
--   * funds checks include bonus_balance
--   * the bonus slice of a stake is recorded under stake_from_principal so
--     a void/refund returns it to a bet-only bucket, never to withdrawable
--     balance.
create or replace function public.fn_place_bet(
  p_bet_type bet_type,
  p_stake numeric,
  p_selections jsonb,
  p_winboost boolean default false,
  p_system_size int default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_self_excluded_until timestamptz;
  v_wallet public.wallets%rowtype;
  v_sel jsonb;
  v_outcome public.odds_outcomes%rowtype;
  v_market public.markets%rowtype;
  v_fixture public.fixtures%rowtype;
  v_count int;
  v_product numeric;
  v_boost_pct numeric := 0;
  v_group_id uuid := gen_random_uuid();
  v_bet_ids uuid[] := '{}';
  v_bet_id uuid;
  v_total_odds numeric;
  v_potential numeric;
  v_selection_rows jsonb[] := '{}';
  v_agent_id uuid;
  v_commission_pct numeric;
  v_split jsonb;
  v_caller_role public.user_role;
  v_house_funded boolean;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if not public.fn_check_rate_limit('bet:' || v_user_id::text, 30, 60) then
    raise exception 'RATE_LIMITED';
  end if;

  select self_exclusion_until into v_self_excluded_until
    from public.responsible_gambling_settings where user_id = v_user_id;
  if v_self_excluded_until is not null and v_self_excluded_until > now() then
    raise exception 'SELF_EXCLUDED';
  end if;

  if p_stake is null or p_stake <= 0 then
    raise exception 'INVALID_STAKE';
  end if;

  v_count := jsonb_array_length(p_selections);
  if v_count < 1 then
    raise exception 'NO_SELECTIONS';
  end if;
  if p_bet_type in ('multiple','system') and v_count < 2 then
    raise exception 'MULTIPLE_REQUIRES_TWO_SELECTIONS';
  end if;
  if p_bet_type = 'system' and (p_system_size is null or p_system_size < 1 or p_system_size >= v_count) then
    raise exception 'INVALID_SYSTEM_SIZE';
  end if;

  select * into v_wallet from public.wallets where user_id = v_user_id for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;

  select p.assigned_agent_id, coalesce(a.commission_rate, 0), p.role
    into v_agent_id, v_commission_pct, v_caller_role
    from public.profiles p left join public.profiles a on a.id = p.assigned_agent_id
    where p.id = v_user_id;

  v_house_funded := v_caller_role = 'super_admin';

  -- ===== SINGLE: one independent bet per selection, each staked p_stake =====
  if p_bet_type = 'single' then
    if not v_house_funded and v_wallet.principal_balance + v_wallet.bonus_balance + v_wallet.balance < p_stake * v_count then
      raise exception 'INSUFFICIENT_FUNDS';
    end if;

    for v_sel in select * from jsonb_array_elements(p_selections) loop
      select o.* into v_outcome from public.odds_outcomes o where o.id = (v_sel->>'outcome_id')::uuid;
      if not found then raise exception 'OUTCOME_NOT_FOUND'; end if;
      select m.* into v_market from public.markets m where m.id = v_outcome.market_id;
      select f.* into v_fixture from public.fixtures f where f.id = v_market.fixture_id;
      if v_market.status <> 'open' then raise exception 'MARKET_SUSPENDED'; end if;
      if v_fixture.status not in ('upcoming','live') then raise exception 'FIXTURE_NOT_AVAILABLE'; end if;

      insert into public.bets (
        user_id, wallet_id, placement_group_id, bet_type, stake,
        total_odds, base_total_odds, winboost_enabled, winboost_pct, potential_payout, status, is_free_bet
      ) values (
        v_user_id, v_wallet.id, v_group_id, 'single', p_stake,
        v_outcome.price, v_outcome.price, false, 0, round(p_stake * v_outcome.price, 2), 'open', v_house_funded
      ) returning id into v_bet_id;

      if not v_house_funded then
        v_split := public.fn_wallet_debit_spend(v_user_id, p_stake, 'bet_stake', 'bet', v_bet_id, 'Single bet stake');
        update public.bets
          set stake_from_principal = (v_split->>'from_principal')::numeric
                                   + coalesce((v_split->>'from_bonus')::numeric, 0),
              stake_from_balance = (v_split->>'from_balance')::numeric
          where id = v_bet_id;
      end if;

      perform public.fn_house_escrow_stake(p_stake, 'bet', v_bet_id, 'Single bet stake escrowed');

      if not v_house_funded and v_agent_id is not null and v_commission_pct > 0 then
        perform public.fn_wallet_credit(v_agent_id, round(p_stake * v_commission_pct / 100, 2), 'commission', 'bet', v_bet_id, 'Turnover commission');
      end if;

      insert into public.bet_selections (
        bet_id, fixture_id, market_id, outcome_id, selection_name, market_name, fixture_label, odds_price
      ) values (
        v_bet_id, v_fixture.id, v_market.id, v_outcome.id, v_outcome.name, v_market.market_name,
        v_fixture.home_team || ' v ' || v_fixture.away_team, v_outcome.price
      );

      v_bet_ids := array_append(v_bet_ids, v_bet_id);
    end loop;

    return jsonb_build_object('bet_ids', to_jsonb(v_bet_ids), 'placement_group_id', v_group_id);
  end if;

  -- ===== MULTIPLE / SYSTEM: one combined bet =====
  if not v_house_funded and v_wallet.principal_balance + v_wallet.bonus_balance + v_wallet.balance < p_stake then
    raise exception 'INSUFFICIENT_FUNDS';
  end if;

  v_product := 1;
  for v_sel in select * from jsonb_array_elements(p_selections) loop
    select o.* into v_outcome from public.odds_outcomes o where o.id = (v_sel->>'outcome_id')::uuid;
    if not found then raise exception 'OUTCOME_NOT_FOUND'; end if;
    select m.* into v_market from public.markets m where m.id = v_outcome.market_id;
    select f.* into v_fixture from public.fixtures f where f.id = v_market.fixture_id;
    if v_market.status <> 'open' then raise exception 'MARKET_SUSPENDED'; end if;
    if v_fixture.status not in ('upcoming','live') then raise exception 'FIXTURE_NOT_AVAILABLE'; end if;

    v_product := v_product * v_outcome.price;
    v_selection_rows := array_append(v_selection_rows, jsonb_build_object(
      'fixture_id', v_fixture.id, 'market_id', v_market.id, 'outcome_id', v_outcome.id,
      'selection_name', v_outcome.name, 'market_name', v_market.market_name,
      'fixture_label', v_fixture.home_team || ' v ' || v_fixture.away_team, 'odds_price', v_outcome.price
    ));
  end loop;

  v_total_odds := round(v_product, 3);
  if p_winboost and p_bet_type = 'multiple' and v_count >= 3 then
    v_boost_pct := 3;
    v_total_odds := round(v_total_odds * 1.03, 3);
  end if;

  if p_bet_type = 'multiple' then
    v_potential := round(p_stake * v_total_odds, 2);
  else
    v_potential := round(p_stake / public.fn_choose(v_count, p_system_size) * v_product, 2);
  end if;

  insert into public.bets (
    user_id, wallet_id, placement_group_id, bet_type, system_size, stake,
    total_odds, base_total_odds, winboost_enabled, winboost_pct, potential_payout, status, is_free_bet
  ) values (
    v_user_id, v_wallet.id, v_group_id, p_bet_type, p_system_size, p_stake,
    v_total_odds, round(v_product,3), p_winboost and v_boost_pct > 0, v_boost_pct, v_potential, 'open', v_house_funded
  ) returning id into v_bet_id;

  if not v_house_funded then
    v_split := public.fn_wallet_debit_spend(v_user_id, p_stake, 'bet_stake', 'bet', v_bet_id, initcap(p_bet_type::text) || ' bet stake');
    update public.bets
      set stake_from_principal = (v_split->>'from_principal')::numeric
                               + coalesce((v_split->>'from_bonus')::numeric, 0),
          stake_from_balance = (v_split->>'from_balance')::numeric
      where id = v_bet_id;
  end if;

  perform public.fn_house_escrow_stake(p_stake, 'bet', v_bet_id, initcap(p_bet_type::text) || ' bet stake escrowed');

  if not v_house_funded and v_agent_id is not null and v_commission_pct > 0 then
    perform public.fn_wallet_credit(v_agent_id, round(p_stake * v_commission_pct / 100, 2), 'commission', 'bet', v_bet_id, 'Turnover commission');
  end if;

  for v_sel in select * from unnest(v_selection_rows) loop
    insert into public.bet_selections (
      bet_id, fixture_id, market_id, outcome_id, selection_name, market_name, fixture_label, odds_price
    ) values (
      v_bet_id, (v_sel->>'fixture_id')::uuid, (v_sel->>'market_id')::uuid, (v_sel->>'outcome_id')::uuid,
      v_sel->>'selection_name', v_sel->>'market_name', v_sel->>'fixture_label', (v_sel->>'odds_price')::numeric
    );
  end loop;

  v_bet_ids := array_append(v_bet_ids, v_bet_id);
  return jsonb_build_object('bet_ids', to_jsonb(v_bet_ids), 'placement_group_id', v_group_id);
end;
$$;

grant execute on function public.fn_place_bet(bet_type, numeric, jsonb, boolean, int) to authenticated;

-- ---------- 4. payment method switches ----------
create table public.payment_method_settings (
  method text primary key,
  label text not null,
  enabled boolean not null default false,
  note text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.payment_method_settings enable row level security;

-- Method availability isn't secret -- the deposit page renders from it.
-- Writes happen only through the super-admin API route (service role).
create policy "payment_method_settings_public_read" on public.payment_method_settings
  for select using (true);

insert into public.payment_method_settings (method, label, enabled, note) values
  ('paynow', 'Paynow', true, 'Hosted checkout: EcoCash, OneMoney, InnBucks, Visa/Mastercard, bank transfer'),
  ('ecocash_instant', 'EcoCash Instant Payment', false, 'Direct EcoCash charge with PIN prompt. Requires live EIP credentials in env vars.')
on conflict (method) do nothing;

-- ---------- 5. admin deposit management ----------
-- approve: credit through fn_complete_deposit (idempotent -- safe even if
--          a webhook lands at the same instant; the row lock serializes).
-- reject:  mark failed; never stomps a completed deposit.
-- reverse: claw a completed deposit back out of principal. Fails loudly
--          if the money is already spent -- forcing the admin to resolve
--          the shortfall deliberately instead of driving a wallet negative.
-- edit:    change amount on an unresolved deposit (audit-logged).
create or replace function public.fn_admin_manage_deposit(
  p_deposit_id uuid,
  p_action text,
  p_amount numeric default null,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_role public.user_role;
  v_d public.deposits%rowtype;
  v_note text := left(coalesce(p_note, ''), 300);
begin
  if v_admin is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select role into v_role from public.profiles where id = v_admin;
  if v_role not in ('admin', 'super_admin') then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select * into v_d from public.deposits where id = p_deposit_id for update;
  if not found then raise exception 'DEPOSIT_NOT_FOUND'; end if;

  if p_action = 'approve' then
    if v_d.status = 'completed' then
      return jsonb_build_object('status', 'completed', 'already', true);
    end if;
    if v_d.status = 'reversed' then
      raise exception 'CANNOT_APPROVE_REVERSED';
    end if;
    perform public.fn_complete_deposit(p_deposit_id);

  elsif p_action = 'reject' then
    if v_d.status = 'completed' then
      raise exception 'CANNOT_REJECT_COMPLETED';
    end if;
    update public.deposits set status = 'failed' where id = p_deposit_id;

  elsif p_action = 'reverse' then
    if v_d.status <> 'completed' then
      raise exception 'ONLY_COMPLETED_CAN_BE_REVERSED';
    end if;
    -- Deposits land in principal; the reversal leaves the same bucket.
    -- Raises INSUFFICIENT_FUNDS if it was already spent.
    perform public.fn_wallet_debit(
      v_d.user_id, v_d.amount, 'adjustment', 'deposit', p_deposit_id,
      'Deposit reversed by admin' || case when v_note <> '' then ': ' || v_note else '' end,
      'completed', v_admin, 'principal'
    );
    update public.deposits set status = 'reversed' where id = p_deposit_id;

  elsif p_action = 'edit' then
    if v_d.status in ('completed', 'reversed') then
      raise exception 'CANNOT_EDIT_RESOLVED_DEPOSIT';
    end if;
    if p_amount is null or p_amount <= 0 or p_amount > 1000000 then
      raise exception 'INVALID_AMOUNT';
    end if;
    update public.deposits set amount = p_amount where id = p_deposit_id;

  else
    raise exception 'UNKNOWN_ACTION';
  end if;

  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, new_values)
  values (
    v_admin, v_role, 'deposit_' || p_action, 'deposit', p_deposit_id,
    jsonb_build_object(
      'amount', coalesce(p_amount, v_d.amount),
      'previous_status', v_d.status,
      'note', v_note
    )
  );

  return jsonb_build_object(
    'deposit_id', p_deposit_id,
    'status', (select status from public.deposits where id = p_deposit_id)
  );
end;
$$;

revoke execute on function public.fn_admin_manage_deposit(uuid, text, numeric, text) from public, anon;
grant execute on function public.fn_admin_manage_deposit(uuid, text, numeric, text) to authenticated;

-- ---------- 6. deposits insert hardening ----------
-- A user could previously insert a deposit row directly with any status --
-- including 'completed'. It could never credit the wallet (that path is
-- service-role only) but a fake "completed" row pollutes admin views and
-- reconciliation. Inserts are limited to unresolved states.
drop policy if exists "deposits_insert_own" on public.deposits;
create policy "deposits_insert_own" on public.deposits
  for insert with check (
    user_id = auth.uid()
    and status in ('pending', 'processing')
  );

-- ---------- ledger reconcile: bonus + voucher awareness ----------
create or replace function public.fn_reconcile_ledger()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anomalies jsonb := '[]'::jsonb;
  v_escrow_ledger numeric;
  v_escrow_open numeric;
  v_bad_buckets int;
  v_bad_locked int;
  v_bad_house int;
  v_house numeric;
  v_house_bets int;
  v_house_open int;
  v_house_staked numeric;
  v_house_open_stake numeric;
begin
  if not public.is_super_admin() then raise exception 'NOT_AUTHORIZED'; end if;

  select escrow_balance, house_balance into v_escrow_ledger, v_house
    from public.house_ledger where id = '00000000-0000-0000-0000-000000000001';
  select coalesce(sum(stake), 0) into v_escrow_open from public.bets where status = 'open';
  if coalesce(v_escrow_ledger, 0) <> v_escrow_open then
    v_anomalies := v_anomalies || jsonb_build_object(
      'check', 'escrow_vs_open_stakes',
      'ledger_escrow', v_escrow_ledger, 'sum_open_stakes', v_escrow_open,
      'diff', coalesce(v_escrow_ledger, 0) - v_escrow_open);
  end if;

  -- every wallet's columns must equal their non-reversed ledger sums.
  -- 'voucher' bucket credits principal_balance physically.
  select count(*) into v_bad_buckets from (
    select w.id
    from public.wallets w
    left join (
      select wallet_id,
        coalesce(sum(amount) filter (where bucket = 'balance'), 0) as bal,
        coalesce(sum(amount) filter (where bucket in ('principal', 'voucher')), 0) as prin,
        coalesce(sum(amount) filter (where bucket = 'bonus'), 0) as bon
      from public.wallet_transactions
      where status <> 'reversed'
      group by wallet_id
    ) t on t.wallet_id = w.id
    where w.balance <> coalesce(t.bal, 0)
       or w.principal_balance <> coalesce(t.prin, 0)
       or w.bonus_balance <> coalesce(t.bon, 0)
  ) x;
  if v_bad_buckets > 0 then
    v_anomalies := v_anomalies || jsonb_build_object(
      'check', 'wallet_buckets_vs_ledger', 'wallets_out_of_balance', v_bad_buckets);
  end if;

  select count(*) into v_bad_locked from (
    select w.id
    from public.wallets w
    left join (
      select wallet_id, sum(amount) as amt
      from public.withdrawals where status = 'pending' group by wallet_id
    ) p on p.wallet_id = w.id
    where w.locked_balance <> coalesce(p.amt, 0)
  ) x;
  if v_bad_locked > 0 then
    v_anomalies := v_anomalies || jsonb_build_object(
      'check', 'locked_balance_vs_pending_withdrawals', 'wallets_out_of_balance', v_bad_locked);
  end if;

  select count(*) into v_bad_house
    from public.bets
    where is_free_bet and (stake_from_principal <> 0 or stake_from_balance <> 0);
  if v_bad_house > 0 then
    v_anomalies := v_anomalies || jsonb_build_object(
      'check', 'house_bet_with_wallet_funding', 'bets_out_of_balance', v_bad_house);
  end if;

  select count(*), coalesce(sum(stake), 0)
    into v_house_bets, v_house_staked
    from public.bets where is_free_bet;
  select count(*), coalesce(sum(stake), 0)
    into v_house_open, v_house_open_stake
    from public.bets where is_free_bet and status = 'open';

  return jsonb_build_object(
    'ok', jsonb_array_length(v_anomalies) = 0,
    'checked_at', now(),
    'house_balance', v_house,
    'escrow_balance', v_escrow_ledger,
    'house_bets', jsonb_build_object(
      'count', v_house_bets,
      'total_staked', v_house_staked,
      'open_count', v_house_open,
      'open_stake', v_house_open_stake
    ),
    'anomalies', v_anomalies
  );
end;
$$;

-- ---------- verification review: open to admins, not just super admins ----------
create or replace function public.fn_review_deposit_verification(
  p_request_id uuid,
  p_approve boolean,
  p_admin_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.deposit_verification_requests%rowtype;
  v_admin uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select * into v_req from public.deposit_verification_requests
    where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'ALREADY_REVIEWED';
  end if;

  if p_approve then
    perform public.fn_complete_deposit(v_req.deposit_id);
    update public.deposit_verification_requests
      set status = 'approved', admin_note = p_admin_note,
          reviewed_by = v_admin, reviewed_at = now()
      where id = p_request_id;
  else
    update public.deposit_verification_requests
      set status = 'rejected', admin_note = p_admin_note,
          reviewed_by = v_admin, reviewed_at = now()
      where id = p_request_id;
    update public.deposits
      set status = 'failed'
      where id = v_req.deposit_id and status not in ('completed');
  end if;

  return jsonb_build_object(
    'request_id', p_request_id,
    'deposit_id', v_req.deposit_id,
    'status', case when p_approve then 'approved' else 'rejected' end
  );
end;
$$;

-- Admins also need to *see* verification requests (was super-admin-only).
drop policy if exists "dvr_select_own_or_super_admin" on public.deposit_verification_requests;
create policy "dvr_select_own_or_admin" on public.deposit_verification_requests
  for select using (user_id = auth.uid() or public.is_admin());
