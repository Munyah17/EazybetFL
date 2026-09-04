-- =====================================================================
-- SAFETY: never let a bet be cashed out when it cannot be fairly priced.
--
-- Cash-out value is derived from live odds on the still-pending legs. If a
-- pending leg's match has already kicked off, or the odds feed hasn't
-- refreshed recently, that price is meaningless -- and (as happened in
-- production while the data feed was out of quota) a user could cash out
-- a bet on matches that finished days ago, against dead odds.
--
-- New rule for BOTH fn_cash_out and fn_cash_out_preview: cash-out is only
-- available when every still-pending leg's fixture has NOT started, and
-- its odds aren't so old they can't be trusted at all (feed down for a
-- day+). Bookmakers suspend cash-out in-play for exactly this reason.
-- The lock is self-healing: it lifts once matches are pre-kickoff and the
-- odds feed is flowing again.
--
-- (Odds normally refresh on the daily catalog sync, so the staleness
-- ceiling is 25h -- generous enough not to trip on a normal cycle, tight
-- enough to catch a genuinely dead feed.)
-- =====================================================================

create or replace function public.fn_cash_out_blocked_reason(p_bet_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.bet_selections bs
      join public.fixtures f on f.id = bs.fixture_id
      where bs.bet_id = p_bet_id
        and bs.status = 'pending'
        and (f.commence_time <= now() or f.status in ('live','finished'))
    ) then 'A match on this bet has already started — cash out is locked in-play.'
    when exists (
      select 1
      from public.bet_selections bs
      join public.odds_outcomes oo on oo.id = bs.outcome_id
      where bs.bet_id = p_bet_id
        and bs.status = 'pending'
        and oo.updated_at < now() - interval '25 hours'
    ) then 'Prices are out of date — cash out is temporarily unavailable.'
    else null
  end
$$;

revoke execute on function public.fn_cash_out_blocked_reason(uuid) from public, anon;
grant execute on function public.fn_cash_out_blocked_reason(uuid) to authenticated, service_role;

-- ---------- preview: expose the lock + reason ----------
create or replace function public.fn_cash_out_preview(p_bet_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_bet public.bets%rowtype;
  v_sel record;
  v_live_odds numeric := 1;
  v_has_lost boolean := false;
  v_fair_value numeric;
  v_cash_value numeric;
  v_blocked text;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select * into v_bet from public.bets where id = p_bet_id and user_id = v_user_id;
  if not found then raise exception 'BET_NOT_FOUND'; end if;
  if v_bet.status <> 'open' then
    return jsonb_build_object('bet_id', p_bet_id, 'cash_out_value', null, 'eligible', false);
  end if;

  v_blocked := public.fn_cash_out_blocked_reason(p_bet_id);
  if v_blocked is not null then
    return jsonb_build_object('bet_id', p_bet_id, 'cash_out_value', null, 'eligible', false, 'reason', v_blocked);
  end if;

  for v_sel in
    select bs.*, oo.price as current_price
    from public.bet_selections bs
    join public.odds_outcomes oo on oo.id = bs.outcome_id
    where bs.bet_id = p_bet_id
  loop
    if v_sel.status = 'lost' then
      v_has_lost := true;
    elsif v_sel.status = 'pending' then
      v_live_odds := v_live_odds * coalesce(v_sel.current_price, v_sel.odds_price);
    end if;
  end loop;

  if v_has_lost then
    v_cash_value := 0;
  else
    v_fair_value := v_bet.stake * (v_bet.total_odds / v_live_odds);
    v_cash_value := round(greatest(v_fair_value, 0) * 0.92, 2);
  end if;

  return jsonb_build_object('bet_id', p_bet_id, 'cash_out_value', v_cash_value, 'eligible', true);
end;
$$;

-- ---------- cash out: refuse when locked ----------
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

  if public.fn_cash_out_blocked_reason(p_bet_id) is not null then
    raise exception 'CASHOUT_LOCKED';
  end if;

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

  perform public.fn_wallet_credit_bet_return(
    v_user_id, v_cash_value, 'cashout', p_bet_id, 'Cash out payout', v_bet.stake_from_principal
  );

  return jsonb_build_object('bet_id', p_bet_id, 'cash_out_value', v_cash_value);
end;
$$;
