-- Carry fixture.commence_time into the booked_bets selections snapshot so
-- the betslip can show kickoff time for a bet loaded back in by code,
-- same as a freshly-picked selection.
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
      'fixture_label', v_fixture.home_team || ' v ' || v_fixture.away_team, 'odds_price', v_outcome.price,
      'commence_time', v_fixture.commence_time
    ));
  end loop;

  v_code := public.generate_bet_code();

  insert into public.booked_bets (user_id, bet_code, bet_type, selections, total_odds, expires_at)
  values (v_user_id, v_code, p_bet_type, to_jsonb(v_snapshot), round(v_product,3), now() + interval '7 days')
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'bet_code', v_code, 'total_odds', round(v_product,3));
end;
$$;
