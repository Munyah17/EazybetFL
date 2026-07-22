-- Read-only cash-out valuation so the UI can show an amount before the
-- user confirms (fn_cash_out itself executes the cashout immediately,
-- so it can't be used as a preview).
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
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select * into v_bet from public.bets where id = p_bet_id and user_id = v_user_id;
  if not found then raise exception 'BET_NOT_FOUND'; end if;
  if v_bet.status <> 'open' then
    return jsonb_build_object('bet_id', p_bet_id, 'cash_out_value', null, 'eligible', false);
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

grant execute on function public.fn_cash_out_preview(uuid) to authenticated;
