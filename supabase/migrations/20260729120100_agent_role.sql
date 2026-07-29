-- Cash-shop "agent" role: agents have their own wallet (float), are linked
-- to a fixed set of customers via a self-service agent code (reusing the
-- existing referral_code column), can move cash between their float and a
-- linked customer's wallet, and earn a % of that customer's turnover.

alter table public.profiles add column assigned_agent_id uuid references public.profiles(id);
alter table public.profiles add column commission_rate numeric(5,2) not null default 0;
create index idx_profiles_assigned_agent on public.profiles(assigned_agent_id);

-- ---------- role check helper (mirrors is_admin()/is_super_admin()) ----------
create or replace function public.is_agent()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'agent');
$$;
grant execute on function public.is_agent() to authenticated, anon;

-- ---------- RLS: agents can see their own customers' profiles/wallets ----------
create policy "profiles_select_agent_customers" on public.profiles
  for select using (assigned_agent_id = auth.uid());

create policy "wallets_select_agent_customers" on public.wallets
  for select using (
    exists (select 1 from public.profiles p where p.id = wallets.user_id and p.assigned_agent_id = auth.uid())
  );

-- ---------- extend the privilege-escalation guard to cover the two new columns ----------
-- commission_rate: super_admin only, same tier as role changes.
-- assigned_agent_id: settable once (null -> an actual agent's id), by the
-- row owner themselves (self-service linking) or a super_admin; immutable
-- after that except by a super_admin, so a customer can't game commission
-- assignment by hopping agents.
create or replace function public.fn_guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if not public.is_super_admin() then
      raise exception 'NOT_AUTHORIZED: only a super admin can change role';
    end if;
  end if;
  if new.status is distinct from old.status then
    if not public.is_admin() then
      raise exception 'NOT_AUTHORIZED: only an admin can change status';
    end if;
  end if;
  if new.commission_rate is distinct from old.commission_rate then
    if not public.is_super_admin() then
      raise exception 'NOT_AUTHORIZED: only a super admin can change commission rate';
    end if;
  end if;
  if new.assigned_agent_id is distinct from old.assigned_agent_id then
    if old.assigned_agent_id is not null and not public.is_super_admin() then
      raise exception 'AGENT_ALREADY_LINKED';
    end if;
    if new.assigned_agent_id is not null then
      if not exists (select 1 from public.profiles where id = new.assigned_agent_id and role = 'agent') then
        raise exception 'AGENT_CODE_NOT_FOUND';
      end if;
      if new.id <> auth.uid() and not public.is_super_admin() then
        raise exception 'NOT_AUTHORIZED: cannot assign another user''s agent';
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- ---------- self-service: link the caller to an agent via that agent's code ----------
create or replace function public.fn_link_agent(p_agent_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_agent_id uuid;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select id into v_agent_id from public.profiles
    where referral_code = upper(p_agent_code) and role = 'agent';
  if v_agent_id is null or v_agent_id = v_user_id then
    raise exception 'AGENT_CODE_NOT_FOUND';
  end if;

  update public.profiles set assigned_agent_id = v_agent_id where id = v_user_id;
end;
$$;
grant execute on function public.fn_link_agent(text) to authenticated;

-- ---------- agent hands cash to one of their own customers ----------
create or replace function public.fn_agent_deposit_customer(p_customer_id uuid, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent_id uuid := auth.uid();
begin
  if v_agent_id is null or not public.is_agent() then raise exception 'NOT_AUTHORIZED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if not exists (select 1 from public.profiles where id = p_customer_id and assigned_agent_id = v_agent_id) then
    raise exception 'NOT_YOUR_CUSTOMER';
  end if;

  perform public.fn_wallet_debit(v_agent_id, p_amount, 'agent_deposit', 'agent_deposit', p_customer_id, 'Cash deposit issued to customer');
  perform public.fn_wallet_credit(p_customer_id, p_amount, 'agent_deposit', 'agent_deposit', p_customer_id, 'Cash deposit via agent');
end;
$$;
grant execute on function public.fn_agent_deposit_customer(uuid, numeric) to authenticated;

-- ---------- agent pays a customer cash to withdraw, reimbursed from customer's wallet ----------
create or replace function public.fn_agent_withdraw_customer(p_customer_id uuid, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent_id uuid := auth.uid();
begin
  if v_agent_id is null or not public.is_agent() then raise exception 'NOT_AUTHORIZED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if not exists (select 1 from public.profiles where id = p_customer_id and assigned_agent_id = v_agent_id) then
    raise exception 'NOT_YOUR_CUSTOMER';
  end if;

  perform public.fn_wallet_debit(p_customer_id, p_amount, 'agent_withdrawal', 'agent_withdrawal', p_customer_id, 'Cash withdrawal via agent');
  perform public.fn_wallet_credit(v_agent_id, p_amount, 'agent_withdrawal', 'agent_withdrawal', p_customer_id, 'Cash withdrawal reimbursement');
end;
$$;
grant execute on function public.fn_agent_withdraw_customer(uuid, numeric) to authenticated;

-- ---------- fn_place_bet: add turnover commission for the bettor's linked agent ----------
-- Identical to the original definition in 20260720100300_functions.sql except
-- for the v_agent_id/v_commission_pct lookup and the two commission credits
-- right after each stake debit (single-loop path and multiple/system path).
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
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
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

  select p.assigned_agent_id, coalesce(a.commission_rate, 0)
    into v_agent_id, v_commission_pct
    from public.profiles p left join public.profiles a on a.id = p.assigned_agent_id
    where p.id = v_user_id;

  -- ===== SINGLE: one independent bet per selection, each staked p_stake =====
  if p_bet_type = 'single' then
    if v_wallet.balance < p_stake * v_count then
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
        total_odds, base_total_odds, winboost_enabled, winboost_pct, potential_payout, status
      ) values (
        v_user_id, v_wallet.id, v_group_id, 'single', p_stake,
        v_outcome.price, v_outcome.price, false, 0, round(p_stake * v_outcome.price, 2), 'open'
      ) returning id into v_bet_id;

      perform public.fn_wallet_debit(v_user_id, p_stake, 'bet_stake', 'bet', v_bet_id, 'Single bet stake');

      if v_agent_id is not null and v_commission_pct > 0 then
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
  if v_wallet.balance < p_stake then
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
    -- system: potential payout if every leg wins = stake_per_line * C(n,k) lines,
    -- each line worth the product of its own odds -> equals stake * (sum of all
    -- k-subset products) / C(n,k) collapsed; simplest accurate max case is all win:
    v_potential := round(p_stake / public.fn_choose(v_count, p_system_size) * v_product, 2);
  end if;

  insert into public.bets (
    user_id, wallet_id, placement_group_id, bet_type, system_size, stake,
    total_odds, base_total_odds, winboost_enabled, winboost_pct, potential_payout, status
  ) values (
    v_user_id, v_wallet.id, v_group_id, p_bet_type, p_system_size, p_stake,
    v_total_odds, round(v_product,3), p_winboost and v_boost_pct > 0, v_boost_pct, v_potential, 'open'
  ) returning id into v_bet_id;

  perform public.fn_wallet_debit(v_user_id, p_stake, 'bet_stake', 'bet', v_bet_id, initcap(p_bet_type::text) || ' bet stake');

  if v_agent_id is not null and v_commission_pct > 0 then
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
