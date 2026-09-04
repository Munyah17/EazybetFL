-- =====================================================================
-- Manual fixture settlement, so bets can always be settled even when the
-- automated scores feed is down (quota, outage, provider change).
--
-- An admin enters the final score for one fixture; this settles every
-- pending h2h / totals selection on that fixture the same way the scores
-- sync does, closes its markets, marks the fixture finished, then settles
-- every now-fully-resolved bet through the normal fn_settle_bet path
-- (escrow release + principal-first payout unchanged).
--
-- Selections on market types this doesn't understand (spreads, btts, ...)
-- are left pending and counted -- an admin can finish those per-bet from
-- the bets queue.
-- =====================================================================

create or replace function public.fn_admin_settle_fixture(
  p_fixture_id uuid,
  p_home_score int,
  p_away_score int
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fixture public.fixtures%rowtype;
  v_market public.markets%rowtype;
  v_sel record;
  v_winner text;
  v_total int;
  v_status public.selection_status;
  v_point numeric;
  v_settled_sel int := 0;
  v_skipped_sel int := 0;
  v_bet record;
  v_settled_bets int := 0;
  v_all_resolved boolean;
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if p_home_score is null or p_away_score is null or p_home_score < 0 or p_away_score < 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  select * into v_fixture from public.fixtures where id = p_fixture_id for update;
  if not found then raise exception 'FIXTURE_NOT_AVAILABLE'; end if;

  v_winner := case
    when p_home_score > p_away_score then v_fixture.home_team
    when p_away_score > p_home_score then v_fixture.away_team
    else 'Draw'
  end;
  v_total := p_home_score + p_away_score;

  for v_market in select * from public.markets where fixture_id = p_fixture_id loop
    for v_sel in
      select bs.* from public.bet_selections bs
      where bs.market_id = v_market.id and bs.status = 'pending'
    loop
      v_status := null;

      if v_market.market_key = 'h2h' then
        v_status := case when v_sel.selection_name = v_winner then 'won' else 'lost' end;
      elsif v_market.market_key = 'totals' then
        select point into v_point from public.odds_outcomes
          where market_id = v_market.id and name = v_sel.selection_name limit 1;
        if v_point is null or v_total = v_point then
          v_status := 'void';
        elsif v_sel.selection_name = 'Over' then
          v_status := case when v_total > v_point then 'won' else 'lost' end;
        elsif v_sel.selection_name = 'Under' then
          v_status := case when v_total < v_point then 'won' else 'lost' end;
        end if;
      end if;

      if v_status is null then
        v_skipped_sel := v_skipped_sel + 1;
      else
        update public.bet_selections set status = v_status, settled_at = now() where id = v_sel.id;
        v_settled_sel := v_settled_sel + 1;
      end if;
    end loop;

    update public.markets set status = 'closed' where id = v_market.id;
  end loop;

  update public.fixtures
    set status = 'finished', home_score = p_home_score, away_score = p_away_score
    where id = p_fixture_id;

  for v_bet in
    select distinct b.id
    from public.bets b
    join public.bet_selections bs on bs.bet_id = b.id
    where bs.fixture_id = p_fixture_id and b.status = 'open'
  loop
    select bool_and(status <> 'pending') into v_all_resolved
      from public.bet_selections where bet_id = v_bet.id;
    if v_all_resolved then
      perform public.fn_settle_bet(v_bet.id);
      v_settled_bets := v_settled_bets + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'fixture_id', p_fixture_id,
    'selections_settled', v_settled_sel,
    'selections_skipped', v_skipped_sel,
    'bets_settled', v_settled_bets
  );
end;
$$;

revoke execute on function public.fn_admin_settle_fixture(uuid, int, int) from public, anon;
grant execute on function public.fn_admin_settle_fixture(uuid, int, int) to authenticated, service_role;

-- ---------- what the manual settlement queue shows ----------
create or replace function public.fn_pending_settlement_fixtures()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.pending_selections desc), '[]'::jsonb)
  into v_result
  from (
    select
      f.id as fixture_id,
      f.home_team || ' v ' || f.away_team as label,
      c.title as competition,
      f.commence_time,
      f.status,
      count(*) filter (where bs.status = 'pending') as pending_selections,
      count(distinct bs.bet_id) filter (where bs.status = 'pending' and b.status = 'open') as affected_bets
    from public.fixtures f
    join public.bet_selections bs on bs.fixture_id = f.id
    join public.bets b on b.id = bs.bet_id
    left join public.competitions c on c.id = f.competition_id
    where bs.status = 'pending'
      and f.status <> 'finished'
      and f.commence_time <= now()
    group by f.id, f.home_team, f.away_team, c.title, f.commence_time, f.status
  ) t;

  return v_result;
end;
$$;

revoke execute on function public.fn_pending_settlement_fixtures() from public, anon;
grant execute on function public.fn_pending_settlement_fixtures() to authenticated, service_role;
