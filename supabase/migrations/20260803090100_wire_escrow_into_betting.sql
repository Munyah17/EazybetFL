-- Same as 20260802090400_place_bet_principal_first.sql, plus: each staked
-- amount is moved into house escrow the moment it's debited from the
-- user, instead of implicitly vanishing until payout time.
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
    if v_wallet.principal_balance + v_wallet.balance < p_stake * v_count then
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

      perform public.fn_wallet_debit_spend(v_user_id, p_stake, 'bet_stake', 'bet', v_bet_id, 'Single bet stake');
      perform public.fn_house_escrow_stake(p_stake, 'bet', v_bet_id, 'Single bet stake escrowed');

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
  if v_wallet.principal_balance + v_wallet.balance < p_stake then
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

  perform public.fn_wallet_debit_spend(v_user_id, p_stake, 'bet_stake', 'bet', v_bet_id, initcap(p_bet_type::text) || ' bet stake');
  perform public.fn_house_escrow_stake(p_stake, 'bet', v_bet_id, initcap(p_bet_type::text) || ' bet stake escrowed');

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

-- ---------- cash out: release escrow the same way settlement does ----------
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
  v_locked_odds numeric := 1;
  v_live_odds numeric := 1;
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
    v_fair_value := v_bet.stake * (v_bet.total_odds / v_live_odds);
    v_cash_value := round(greatest(v_fair_value, 0) * 0.92, 2);
  end if;

  update public.bets
    set status = 'cashed_out', cash_out_value = v_cash_value, cashed_out_at = now(), settled_at = now()
    where id = p_bet_id;

  perform public.fn_house_release_escrow(v_bet.stake, v_cash_value, 'bet', p_bet_id, 'Bet cashed out');

  if v_cash_value > 0 then
    perform public.fn_wallet_credit(v_user_id, v_cash_value, 'cashout', 'bet', p_bet_id, 'Cash out payout');
  end if;

  return jsonb_build_object('bet_id', p_bet_id, 'cash_out_value', v_cash_value);
end;
$$;

-- ---------- settle bet: release escrow the same way cash-out does ----------
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

  perform public.fn_house_release_escrow(v_bet.stake, v_payout, 'bet', p_bet_id,
    initcap(v_new_status::text) || ' bet settled');

  if v_payout > 0 then
    perform public.fn_wallet_credit(v_bet.user_id, v_payout, 'bet_payout', 'bet', p_bet_id,
      initcap(v_new_status::text) || ' bet payout');
  end if;

  return jsonb_build_object('bet_id', p_bet_id, 'status', v_new_status, 'payout', v_payout);
end;
$$;
