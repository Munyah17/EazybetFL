-- =====================================================================
-- EazyBet business logic: wallet ledger, bet placement, booking,
-- cash out, settlement, withdrawals, deposits.
-- All SECURITY DEFINER functions run as the table owner and therefore
-- bypass RLS internally, but each one authorizes against auth.uid()
-- (or an explicit admin check) before doing anything.
-- =====================================================================

-- ---------- new user -> profile + wallet ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  v_code := 'EZ' || upper(substr(md5(new.id::text), 1, 6));

  insert into public.profiles (id, full_name, email, phone, referral_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''), '@', 1), 'EazyBet Player'),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', new.phone),
    v_code
  )
  on conflict (id) do nothing;

  insert into public.wallets (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- bet code generator ----------
create or replace function public.generate_bet_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
  exists_already boolean;
begin
  loop
    code := 'EZY';
    for i in 1..7 loop
      code := code || substr(chars, (floor(random() * length(chars)) + 1)::int, 1);
    end loop;
    select exists(select 1 from public.booked_bets where bet_code = code) into exists_already;
    exit when not exists_already;
  end loop;
  return code;
end;
$$;

-- ---------- wallet credit / debit primitives ----------
create or replace function public.fn_wallet_credit(
  p_user_id uuid,
  p_amount numeric,
  p_type wallet_tx_type,
  p_reference_type text,
  p_reference_id uuid,
  p_description text,
  p_status wallet_tx_status default 'completed',
  p_created_by uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.wallets%rowtype;
  v_tx_id uuid;
begin
  select * into v_wallet from public.wallets where user_id = p_user_id for update;
  if not found then
    raise exception 'WALLET_NOT_FOUND';
  end if;

  update public.wallets
    set balance = balance + p_amount, updated_at = now()
    where user_id = p_user_id
    returning * into v_wallet;

  insert into public.wallet_transactions (
    wallet_id, user_id, type, status, amount, balance_before, balance_after,
    reference_type, reference_id, description, created_by
  ) values (
    v_wallet.id, p_user_id, p_type, p_status, p_amount,
    v_wallet.balance - p_amount, v_wallet.balance,
    p_reference_type, p_reference_id, p_description, p_created_by
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
  p_created_by uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.wallets%rowtype;
  v_tx_id uuid;
begin
  select * into v_wallet from public.wallets where user_id = p_user_id for update;
  if not found then
    raise exception 'WALLET_NOT_FOUND';
  end if;
  if v_wallet.balance < p_amount then
    raise exception 'INSUFFICIENT_FUNDS';
  end if;

  update public.wallets
    set balance = balance - p_amount, updated_at = now()
    where user_id = p_user_id
    returning * into v_wallet;

  insert into public.wallet_transactions (
    wallet_id, user_id, type, status, amount, balance_before, balance_after,
    reference_type, reference_id, description, created_by
  ) values (
    v_wallet.id, p_user_id, p_type, p_status, -p_amount,
    v_wallet.balance + p_amount, v_wallet.balance,
    p_reference_type, p_reference_id, p_description, p_created_by
  ) returning id into v_tx_id;

  return v_tx_id;
end;
$$;

-- ---------- binomial coefficient ----------
create or replace function public.fn_choose(n int, k int)
returns numeric
language plpgsql
immutable
as $$
declare
  result numeric := 1;
  i int;
begin
  if k < 0 or k > n then return 0; end if;
  if k = 0 or k = n then return 1; end if;
  for i in 0..k-1 loop
    result := result * (n - i) / (i + 1);
  end loop;
  return round(result);
end;
$$;

-- ---------- place bet ----------
-- p_selections: jsonb array of {"outcome_id": "<uuid>"}
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

-- ---------- book bet (save selections for later, no stake) ----------
create or replace function public.fn_book_bet(
  p_bet_type bet_type,
  p_selections jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
  v_id uuid;
  v_sel jsonb;
  v_outcome public.odds_outcomes%rowtype;
  v_market public.markets%rowtype;
  v_fixture public.fixtures%rowtype;
  v_product numeric := 1;
  v_snapshot jsonb[] := '{}';
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if jsonb_array_length(p_selections) < 1 then raise exception 'NO_SELECTIONS'; end if;

  for v_sel in select * from jsonb_array_elements(p_selections) loop
    select o.* into v_outcome from public.odds_outcomes o where o.id = (v_sel->>'outcome_id')::uuid;
    if not found then raise exception 'OUTCOME_NOT_FOUND'; end if;
    select m.* into v_market from public.markets m where m.id = v_outcome.market_id;
    select f.* into v_fixture from public.fixtures f where f.id = v_market.fixture_id;
    v_product := v_product * v_outcome.price;
    v_snapshot := array_append(v_snapshot, jsonb_build_object(
      'fixture_id', v_fixture.id, 'market_id', v_market.id, 'outcome_id', v_outcome.id,
      'selection_name', v_outcome.name, 'market_name', v_market.market_name,
      'fixture_label', v_fixture.home_team || ' v ' || v_fixture.away_team, 'odds_price', v_outcome.price
    ));
  end loop;

  v_code := public.generate_bet_code();

  insert into public.booked_bets (user_id, bet_code, bet_type, selections, total_odds, expires_at)
  values (v_user_id, v_code, p_bet_type, to_jsonb(v_snapshot), round(v_product,3), now() + interval '7 days')
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'bet_code', v_code, 'total_odds', round(v_product,3));
end;
$$;

-- ---------- load booked bet by code (public: no auth required to preview) ----------
create or replace function public.fn_load_booked_bet(p_bet_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.booked_bets%rowtype;
begin
  select * into v_booking from public.booked_bets where bet_code = upper(p_bet_code);
  if not found then raise exception 'CODE_NOT_FOUND'; end if;
  if v_booking.status = 'cancelled' then raise exception 'CODE_CANCELLED'; end if;
  if v_booking.expires_at < now() then
    update public.booked_bets set status = 'expired' where id = v_booking.id;
    raise exception 'CODE_EXPIRED';
  end if;

  update public.booked_bets
    set load_count = load_count + 1, loaded_at = now(), status = 'loaded'
    where id = v_booking.id;

  return jsonb_build_object(
    'id', v_booking.id, 'bet_code', v_booking.bet_code, 'bet_type', v_booking.bet_type,
    'selections', v_booking.selections, 'total_odds', v_booking.total_odds, 'expires_at', v_booking.expires_at
  );
end;
$$;

-- ---------- cash out (simplified fair-value model, 92% payback of live value) ----------
create or replace function public.fn_cash_out(p_bet_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_bet public.bets%rowtype;
  v_sel record;
  v_locked_odds numeric := 1;   -- product of odds for already-won legs
  v_live_odds numeric := 1;     -- product of *current* odds for still-pending legs
  v_has_lost boolean := false;
  v_fair_value numeric;
  v_cash_value numeric;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select * into v_bet from public.bets where id = p_bet_id and user_id = v_user_id for update;
  if not found then raise exception 'BET_NOT_FOUND'; end if;
  if v_bet.status <> 'open' then raise exception 'BET_NOT_CASHOUTABLE'; end if;

  for v_sel in
    select bs.*, oo.price as current_price, m.status as market_status
    from public.bet_selections bs
    join public.odds_outcomes oo on oo.id = bs.outcome_id
    join public.markets m on m.id = bs.market_id
    where bs.bet_id = p_bet_id
  loop
    if v_sel.status = 'lost' then
      v_has_lost := true;
    elsif v_sel.status = 'won' then
      v_locked_odds := v_locked_odds * v_sel.odds_price;
    else
      v_live_odds := v_live_odds * coalesce(v_sel.current_price, v_sel.odds_price);
    end if;
  end loop;

  if v_has_lost then
    v_cash_value := 0;
  else
    -- fair value = stake * (original total odds / current combined odds of still-pending legs);
    -- already-won legs' original odds are already baked into total_odds and cancel out of the ratio.
    v_fair_value := v_bet.stake * (v_bet.total_odds / v_live_odds);
    v_cash_value := round(greatest(v_fair_value, 0) * 0.92, 2);
  end if;

  update public.bets
    set status = 'cashed_out', cash_out_value = v_cash_value, cashed_out_at = now(), settled_at = now()
    where id = p_bet_id;

  if v_cash_value > 0 then
    perform public.fn_wallet_credit(v_user_id, v_cash_value, 'cashout', 'bet', p_bet_id, 'Cash out payout');
  end if;

  return jsonb_build_object('bet_id', p_bet_id, 'cash_out_value', v_cash_value);
end;
$$;

-- ---------- admin: settle an individual selection's result ----------
create or replace function public.fn_settle_selection(p_selection_id uuid, p_status selection_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  update public.bet_selections set status = p_status, settled_at = now() where id = p_selection_id;
end;
$$;

-- ---------- admin: settle a whole bet once all its selections are resolved ----------
create or replace function public.fn_settle_bet(p_bet_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bet public.bets%rowtype;
  v_pending_count int;
  v_lost_count int;
  v_void_count int;
  v_total_count int;
  v_won_count int;
  v_won_odds numeric[] := '{}';
  v_e numeric[];
  v_j int;
  v_effective_n int;
  v_effective_k int;
  v_lines numeric;
  v_payout numeric := 0;
  v_new_status bet_status;
  v_rec record;
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;

  select * into v_bet from public.bets where id = p_bet_id for update;
  if not found then raise exception 'BET_NOT_FOUND'; end if;
  if v_bet.status not in ('open') then raise exception 'BET_ALREADY_SETTLED'; end if;

  select count(*) filter (where status = 'pending'),
         count(*) filter (where status = 'lost'),
         count(*) filter (where status = 'void'),
         count(*) filter (where status = 'won'),
         count(*)
    into v_pending_count, v_lost_count, v_void_count, v_won_count, v_total_count
    from public.bet_selections where bet_id = p_bet_id;

  if v_pending_count > 0 then
    raise exception 'SELECTIONS_NOT_FULLY_SETTLED';
  end if;

  if v_bet.bet_type in ('single','multiple') then
    if v_lost_count > 0 then
      v_new_status := 'lost';
      v_payout := 0;
    else
      v_new_status := 'won';
      -- recompute payout from only non-void legs' odds (voids treated as 1.0 / stake returned on that leg)
      select coalesce(exp(sum(ln(odds_price))), 1) into v_payout
        from public.bet_selections where bet_id = p_bet_id and status = 'won';
      if v_won_count = 0 then
        v_payout := v_bet.stake; -- all legs void -> stake returned
      else
        v_payout := round(v_bet.stake * v_payout * case when v_bet.winboost_enabled then 1.03 else 1 end, 2);
      end if;
    end if;
  else
    -- system bet: elementary symmetric polynomial over the odds of WON legs
    v_effective_n := v_total_count - v_void_count;
    v_effective_k := least(v_bet.system_size, greatest(v_effective_n,0));

    if v_effective_n = 0 or v_effective_k = 0 then
      v_new_status := 'lost';
      v_payout := 0;
    else
      for v_rec in select odds_price from public.bet_selections where bet_id = p_bet_id and status = 'won' loop
        v_won_odds := array_append(v_won_odds, v_rec.odds_price);
      end loop;

      -- Elementary symmetric polynomial e_k over the won odds via DP.
      -- v_e is 1-indexed: v_e[j+1] holds e_j (e_0 = 1, the empty product).
      v_e := array_fill(0::numeric, array[v_effective_k + 1]);
      v_e[1] := 1;
      declare
        v_odd numeric;
        v_kk int;
      begin
        for v_odd in select unnest(v_won_odds) loop
          for v_kk in reverse least(v_effective_k, array_length(v_won_odds,1))..1 loop
            v_e[v_kk+1] := v_e[v_kk+1] + v_e[v_kk] * v_odd;
          end loop;
        end loop;
      end;

      v_lines := public.fn_choose(v_effective_n, v_effective_k);
      if v_lines = 0 then
        v_payout := 0;
      else
        v_payout := round((v_bet.stake / v_lines) * v_e[v_effective_k+1], 2);
      end if;
      v_new_status := case when v_payout > 0 then 'won' else 'lost' end;
    end if;
  end if;

  update public.bets
    set status = v_new_status, settled_at = now(), cash_out_value = null
    where id = p_bet_id;

  if v_payout > 0 then
    perform public.fn_wallet_credit(v_bet.user_id, v_payout, 'bet_payout', 'bet', p_bet_id,
      initcap(v_new_status::text) || ' bet payout');
  end if;

  return jsonb_build_object('bet_id', p_bet_id, 'status', v_new_status, 'payout', v_payout);
end;
$$;

-- ---------- withdrawals: request / approve / reject ----------
create or replace function public.fn_request_withdrawal(
  p_amount numeric, p_method payment_method, p_destination jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet public.wallets%rowtype;
  v_id uuid;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;

  select * into v_wallet from public.wallets where user_id = v_user_id for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;
  if v_wallet.balance < p_amount then raise exception 'INSUFFICIENT_FUNDS'; end if;

  update public.wallets
    set balance = balance - p_amount, locked_balance = locked_balance + p_amount, updated_at = now()
    where user_id = v_user_id;

  insert into public.withdrawals (user_id, wallet_id, method, amount, destination, status)
  values (v_user_id, v_wallet.id, p_method, p_amount, p_destination, 'pending')
  returning id into v_id;

  insert into public.wallet_transactions (
    wallet_id, user_id, type, status, amount, balance_before, balance_after, reference_type, reference_id, description
  ) values (
    v_wallet.id, v_user_id, 'withdrawal', 'pending', -p_amount,
    v_wallet.balance, v_wallet.balance - p_amount, 'withdrawal', v_id, 'Withdrawal requested'
  );

  return v_id;
end;
$$;

create or replace function public.fn_approve_withdrawal(p_withdrawal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_w public.withdrawals%rowtype;
  v_admin uuid := auth.uid();
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;

  select * into v_w from public.withdrawals where id = p_withdrawal_id for update;
  if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;
  if v_w.status <> 'pending' then raise exception 'ALREADY_REVIEWED'; end if;

  update public.wallets set locked_balance = locked_balance - v_w.amount, updated_at = now()
    where id = v_w.wallet_id;

  update public.withdrawals
    set status = 'completed', reviewed_by = v_admin, reviewed_at = now(), completed_at = now()
    where id = p_withdrawal_id;

  update public.wallet_transactions set status = 'completed'
    where reference_type = 'withdrawal' and reference_id = p_withdrawal_id;
end;
$$;

create or replace function public.fn_reject_withdrawal(p_withdrawal_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_w public.withdrawals%rowtype;
  v_admin uuid := auth.uid();
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;

  select * into v_w from public.withdrawals where id = p_withdrawal_id for update;
  if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;
  if v_w.status <> 'pending' then raise exception 'ALREADY_REVIEWED'; end if;

  update public.wallets
    set locked_balance = locked_balance - v_w.amount, balance = balance + v_w.amount, updated_at = now()
    where id = v_w.wallet_id;

  update public.withdrawals
    set status = 'rejected', reviewed_by = v_admin, reviewed_at = now(), rejection_reason = p_reason
    where id = p_withdrawal_id;

  update public.wallet_transactions set status = 'reversed'
    where reference_type = 'withdrawal' and reference_id = p_withdrawal_id;
end;
$$;

-- ---------- deposits: mark completed (called by Paynow webhook via service role) ----------
create or replace function public.fn_complete_deposit(p_deposit_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_d public.deposits%rowtype;
begin
  select * into v_d from public.deposits where id = p_deposit_id for update;
  if not found then raise exception 'DEPOSIT_NOT_FOUND'; end if;
  if v_d.status = 'completed' then return; end if;

  update public.deposits set status = 'completed', completed_at = now() where id = p_deposit_id;

  perform public.fn_wallet_credit(v_d.user_id, v_d.amount, 'deposit', 'deposit', p_deposit_id, 'Deposit via ' || v_d.method::text);
end;
$$;

create or replace function public.fn_fail_deposit(p_deposit_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.deposits set status = 'failed' where id = p_deposit_id and status <> 'completed';
end;
$$;

-- ---------- expire booked bets (called by scheduled edge function) ----------
create or replace function public.fn_expire_booked_bets()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.booked_bets set status = 'expired'
    where status in ('active','loaded') and expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- =====================================================================
-- Lock down the execute surface. Postgres grants EXECUTE on new
-- functions to PUBLIC by default -- that would let any authenticated
-- client call fn_wallet_credit/fn_wallet_debit directly and move money
-- arbitrarily. Revoke the dangerous internal primitives from
-- anon/authenticated and only expose the vetted, auth-checked API.
-- =====================================================================
revoke execute on function public.fn_wallet_credit(uuid, numeric, wallet_tx_type, text, uuid, text, wallet_tx_status, uuid) from public;
revoke execute on function public.fn_wallet_debit(uuid, numeric, wallet_tx_type, text, uuid, text, wallet_tx_status, uuid) from public;
revoke execute on function public.fn_complete_deposit(uuid) from public;
revoke execute on function public.fn_fail_deposit(uuid) from public;
revoke execute on function public.fn_expire_booked_bets() from public;
revoke execute on function public.handle_new_user() from public;

grant execute on function public.fn_wallet_credit(uuid, numeric, wallet_tx_type, text, uuid, text, wallet_tx_status, uuid) to service_role;
grant execute on function public.fn_wallet_debit(uuid, numeric, wallet_tx_type, text, uuid, text, wallet_tx_status, uuid) to service_role;
grant execute on function public.fn_complete_deposit(uuid) to service_role;
grant execute on function public.fn_fail_deposit(uuid) to service_role;
grant execute on function public.fn_expire_booked_bets() to service_role;

grant execute on function public.fn_place_bet(bet_type, numeric, jsonb, boolean, int) to authenticated;
grant execute on function public.fn_book_bet(bet_type, jsonb) to authenticated;
grant execute on function public.fn_load_booked_bet(text) to authenticated, anon;
grant execute on function public.fn_cash_out(uuid) to authenticated;
grant execute on function public.fn_settle_selection(uuid, selection_status) to authenticated;
grant execute on function public.fn_settle_bet(uuid) to authenticated;
grant execute on function public.fn_request_withdrawal(numeric, payment_method, jsonb) to authenticated;
grant execute on function public.fn_approve_withdrawal(uuid) to authenticated;
grant execute on function public.fn_reject_withdrawal(uuid, text) to authenticated;
grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.is_super_admin() to authenticated, anon;
grant execute on function public.generate_bet_code() to authenticated;
grant execute on function public.fn_choose(int, int) to authenticated;
