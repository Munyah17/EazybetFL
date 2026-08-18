-- Same as 20260803090100_wire_escrow_into_betting.sql's fn_place_bet,
-- plus a self-exclusion check right after auth -- self-exclusion is
-- supposed to stop gambling entirely, not just deposits.
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
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
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
