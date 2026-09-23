-- =====================================================================
-- Instant dead-bet settlement + in-play dynamic cash-out engine.
--
-- SETTLEMENT
--   A betslip is settled the moment its outcome is mathematically
--   decided, not when the last fixture ends:
--     - single/multiple: ANY lost leg kills the ticket -> settle lost now
--     - system k/n: dead once won + pending legs can no longer reach k
--   Lost stakes flow to the house reserve via fn_house_release_escrow
--   (the "system wallet" the super admin sees on the escrow page); wins
--   credit the player's wallet principal-first. Unresolved legs on a
--   dead ticket stay 'pending' for display -- they no longer matter.
--
-- CASH-OUT (per bet, re-evaluated on every request)
--   Each pending leg gets a live win probability:
--     - pre-match: implied probability from current market prices,
--       overround removed
--     - in-play soccer: Poisson goal model -- pre-match 1x2 probabilities
--       set team supremacy, elapsed time scales expected remaining goals,
--       current score is the starting state
--     - in-play other sports (h2h only): time-decay blend of the pre-match
--       probability toward the current leader
--     - unpriceable leg (no fresh score, exotic market): cash-out locks
--   Bet win probability = product of leg probabilities (void legs skip).
--   Fair value = potential_payout * P(win).
--
--   House rule: an offer only exists when the PLAYER is ahead
--   (fair value > stake -- i.e. the house is losing the position), and
--   that offer is 40% below fair value. When the house is ahead the
--   position is locked. The client never sees the internals -- just an
--   eligible flag and an amount.
-- =====================================================================

-- ---------- poisson pmf ----------
create or replace function public.fn_poisson_pmf(k int, lam numeric)
returns numeric
language sql
immutable
as $$
  select case
    when lam <= 0 then case when k = 0 then 1::numeric else 0::numeric end
    else exp(-lam) * power(lam, k) / factorial(k)
  end
$$;

-- ---------- per-leg live win probability ----------
-- Returns: 1 won / 0 lost / -1 void (exclude leg) / p in (0,1) pending /
-- NULL when the leg cannot be priced right now (caller locks cash-out).
create or replace function public.fn_leg_win_probability(p_selection_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sel public.bet_selections%rowtype;
  v_fx public.fixtures%rowtype;
  v_market_key text;
  v_cur_price numeric;
  v_point numeric;
  v_overround numeric;
  v_sport text;
  v_elapsed numeric;
  v_t numeric;
  v_ph numeric;
  v_pd numeric;
  v_pa numeric;
  v_sum numeric;
  v_lam_h numeric;
  v_lam_a numeric;
  v_lam_t numeric;
  v_sup numeric;
  v_i int;
  v_j int;
  v_p numeric;
  v_tot numeric;
  v_pwin numeric := 0;
  v_ppush numeric := 0;
  v_plose numeric := 0;
  v_sel_side int;
  v_leader int;
begin
  select * into v_sel from public.bet_selections where id = p_selection_id;
  if not found then return null; end if;

  if v_sel.status = 'won' then return 1; end if;
  if v_sel.status = 'lost' then return 0; end if;
  if v_sel.status = 'void' then return -1; end if;

  select m.market_key, o.price, o.point
    into v_market_key, v_cur_price, v_point
    from public.markets m
    join public.odds_outcomes o on o.id = v_sel.outcome_id
   where m.id = v_sel.market_id;

  select * into v_fx from public.fixtures where id = v_sel.fixture_id;
  if not found then return null; end if;

  -- Normalized implied probability (overround removed) across the market.
  select sum(1 / nullif(o.price, 0)) into v_overround
    from public.odds_outcomes o
   where o.market_id = v_sel.market_id;
  if v_overround is null or v_overround <= 0 or v_cur_price is null or v_cur_price <= 1 then
    v_overround := null;
  end if;

  -- ===== pre-match: fixture hasn't started =====
  if v_fx.status = 'upcoming' or v_fx.commence_time > now() then
    if v_overround is not null then
      return least(greatest((1 / v_cur_price) / v_overround, 0.01), 0.99);
    end if;
    return least(greatest(1 / v_sel.odds_price, 0.01), 0.99);
  end if;

  -- ===== in-play: needs a fresh scoreline to price against =====
  if v_fx.home_score is null or v_fx.away_score is null
     or v_fx.updated_at < now() - interval '10 minutes' then
    return null;
  end if;

  v_elapsed := coalesce(
    v_fx.minute,
    extract(epoch from (now() - v_fx.commence_time)) / 60
      - case when extract(epoch from (now() - v_fx.commence_time)) / 60 > 60 then 15 else 0 end
  );
  v_elapsed := least(greatest(v_elapsed, 0), 95);
  v_t := v_elapsed / 95.0;

  select sg.name into v_sport
    from public.competitions c
    join public.sport_groups sg on sg.id = c.sport_group_id
   where c.id = v_fx.competition_id;

  if lower(coalesce(v_sport, '')) in ('soccer', 'football') then
    -- Pre-match normalized 1x2 probabilities = team-strength prior.
    select
      max(case when o.name = v_fx.home_team then 1 / o.price end),
      max(case when o.name = 'Draw' then 1 / o.price end),
      max(case when o.name = v_fx.away_team then 1 / o.price end)
      into v_ph, v_pd, v_pa
      from public.odds_outcomes o
      join public.markets m on m.id = o.market_id
     where m.fixture_id = v_fx.id and m.market_key = 'h2h';
    if v_ph is null or v_pa is null then return null; end if;
    v_pd := coalesce(v_pd, 0);
    v_sum := v_ph + v_pd + v_pa;
    v_ph := v_ph / v_sum;
    v_pd := v_pd / v_sum;
    v_pa := v_pa / v_sum;

    -- Expected remaining goals: ~2.7/game baseline, decayed by elapsed
    -- fraction, +12% for late-game scoring rate. Split by supremacy.
    v_lam_t := 2.7 * (1 - v_t) * 1.12;
    v_sup := greatest(v_ph, 0.02) / greatest(v_pa, 0.02);
    v_lam_h := v_lam_t * v_sup / (1 + v_sup);
    v_lam_a := v_lam_t / (1 + v_sup);

    if v_market_key = 'h2h' then
      for v_i in 0..8 loop
        for v_j in 0..8 loop
          v_p := public.fn_poisson_pmf(v_i, v_lam_h) * public.fn_poisson_pmf(v_j, v_lam_a);
          if v_fx.home_score + v_i > v_fx.away_score + v_j then
            v_pwin := v_pwin + v_p;
          elsif v_fx.home_score + v_i = v_fx.away_score + v_j then
            v_ppush := v_ppush + v_p;
          else
            v_plose := v_plose + v_p;
          end if;
        end loop;
      end loop;
      if v_sel.selection_name = v_fx.home_team then
        return least(greatest(v_pwin, 0.01), 0.99);
      elsif v_sel.selection_name = v_fx.away_team then
        return least(greatest(v_plose, 0.01), 0.99);
      end if;
      return least(greatest(v_ppush, 0.01), 0.99); -- Draw
    elsif v_market_key = 'totals' and v_point is not null then
      for v_i in 0..10 loop
        v_p := public.fn_poisson_pmf(v_i, v_lam_h + v_lam_a);
        v_tot := v_fx.home_score + v_fx.away_score + v_i;
        if v_tot > v_point then
          v_pwin := v_pwin + v_p;
        elsif v_tot = v_point then
          v_ppush := v_ppush + v_p; -- exact line = push = leg voids = neutral
        else
          v_plose := v_plose + v_p;
        end if;
      end loop;
      if v_sel.selection_name = 'Over' then
        return least(greatest(v_pwin + v_ppush, 0.01), 0.99);
      elsif v_sel.selection_name = 'Under' then
        return least(greatest(v_plose + v_ppush, 0.01), 0.99);
      end if;
      return null;
    end if;
    return null; -- other soccer markets aren't priced in-play
  end if;

  -- ===== non-soccer in-play: time-decay blend, h2h only =====
  if v_market_key <> 'h2h' then return null; end if;

  v_sel_side := case
    when v_sel.selection_name = v_fx.home_team then 1
    when v_sel.selection_name = v_fx.away_team then -1
    else 0
  end;
  v_leader := sign(v_fx.home_score - v_fx.away_score)::int;

  if v_overround is not null then
    v_pwin := (1 / v_cur_price) / v_overround;
  else
    v_pwin := 1 / v_sel.odds_price;
  end if;

  if v_sel_side = 0 then
    -- Draw selection: decays toward 0 unless still tied late.
    return least(greatest(
      v_pwin * (1 - v_t) + (case when v_leader = 0 then 0.5 else 0.05 end) * v_t,
      0.01), 0.99);
  end if;

  return least(greatest(v_pwin + (v_sel_side * v_leader) * v_t * 0.85, 0.02), 0.98);
end;
$$;

-- ---------- bet-level cash-out quote ----------
create or replace function public.fn_bet_cashout_quote(p_bet_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_bet public.bets%rowtype;
  v_sel record;
  v_p numeric;
  v_p_bet numeric := 1;
  v_fair numeric;
  v_offer numeric;
begin
  select * into v_bet from public.bets where id = p_bet_id;
  if not found or v_bet.status <> 'open' then
    return jsonb_build_object('eligible', false, 'cash_out_value', null);
  end if;

  for v_sel in select id from public.bet_selections where bet_id = p_bet_id loop
    v_p := public.fn_leg_win_probability(v_sel.id);
    if v_p is null then
      return jsonb_build_object(
        'eligible', false, 'cash_out_value', null,
        'reason', 'Cash out is not available for this bet right now.');
    end if;
    if v_p >= 0 then -- -1 marks a void leg: excluded from the product
      v_p_bet := v_p_bet * v_p;
    end if;
  end loop;

  v_fair := least(v_bet.potential_payout * v_p_bet, v_bet.potential_payout);

  -- Player ahead (house losing the position) -> buy it back at 40% below
  -- fair value. House ahead -> locked, no offer.
  if v_fair > v_bet.stake then
    v_offer := round(v_fair * 0.60, 2);
    return jsonb_build_object(
      'eligible', true,
      'cash_out_value', v_offer,
      'fair_value', round(v_fair, 2),
      'win_probability', round(v_p_bet, 4));
  end if;

  return jsonb_build_object(
    'eligible', false, 'cash_out_value', null,
    'reason', 'Cash out is not available for this bet right now.');
end;
$$;

-- ---------- blocked reason: dead-feed guard only ----------
-- In-play is no longer blanket-locked -- the quote engine prices live
-- legs and locks per-bet when it can't. What remains worth a hard stop:
-- a pending PRE-MATCH leg whose odds are 25h+ stale (feed genuinely dead).
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
      join public.odds_outcomes oo on oo.id = bs.outcome_id
      join public.fixtures f on f.id = bs.fixture_id
      where bs.bet_id = p_bet_id
        and bs.status = 'pending'
        and f.commence_time > now()
        and oo.updated_at < now() - interval '25 hours'
    ) then 'Prices are out of date — cash out is temporarily unavailable.'
    else null
  end
$$;

-- ---------- preview: quote engine + dead-feed guard ----------
create or replace function public.fn_cash_out_preview(p_bet_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_bet public.bets%rowtype;
  v_blocked text;
  v_quote jsonb;
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

  v_quote := public.fn_bet_cashout_quote(p_bet_id);
  return jsonb_build_object('bet_id', p_bet_id) || v_quote;
end;
$$;

-- ---------- cash out: execute at the quoted price ----------
create or replace function public.fn_cash_out(p_bet_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_bet public.bets%rowtype;
  v_quote jsonb;
  v_cash_value numeric;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select * into v_bet from public.bets where id = p_bet_id and user_id = v_user_id for update;
  if not found then raise exception 'BET_NOT_FOUND'; end if;
  if v_bet.status <> 'open' then raise exception 'BET_NOT_CASHOUTABLE'; end if;

  if public.fn_cash_out_blocked_reason(p_bet_id) is not null then
    raise exception 'CASHOUT_LOCKED';
  end if;

  -- Re-quoted under the row lock, so the price can't go stale between
  -- the user's preview and their click.
  v_quote := public.fn_bet_cashout_quote(p_bet_id);
  if not coalesce((v_quote ->> 'eligible')::boolean, false) then
    raise exception 'CASHOUT_LOCKED';
  end if;
  v_cash_value := (v_quote ->> 'cash_out_value')::numeric;

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

-- ---------- settle bet: instant once the outcome is decided ----------
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
  v_dead boolean;
  v_won_odds numeric[] := '{}';
  v_e numeric[];
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

  -- Is the ticket's fate already sealed?
  --   single/multiple: one lost leg kills it (every leg must win).
  --   system k/n: dead when won + pending can no longer reach k winners.
  if v_bet.bet_type = 'system' then
    v_dead := (v_won_count + v_pending_count) < coalesce(v_bet.system_size, 1);
  else
    v_dead := v_lost_count > 0;
  end if;

  if v_pending_count > 0 and not v_dead then
    -- Nothing decided yet -- callers poll this freely, so return instead
    -- of raising.
    return jsonb_build_object('bet_id', p_bet_id, 'status', 'open', 'payout', 0, 'deferred', true);
  end if;

  if v_dead then
    v_new_status := 'lost';
    v_payout := 0;
  elsif v_bet.bet_type in ('single','multiple') then
    v_new_status := 'won';
    -- recompute payout from only non-void legs' odds (voids treated as 1.0)
    select coalesce(exp(sum(ln(odds_price))), 1) into v_payout
      from public.bet_selections where bet_id = p_bet_id and status = 'won';
    if v_won_count = 0 then
      v_payout := v_bet.stake; -- all legs void -> stake returned
    else
      v_payout := round(v_bet.stake * v_payout * case when v_bet.winboost_enabled then 1.03 else 1 end, 2);
    end if;
  else
    -- system bet, fully resolved and not dead: elementary symmetric
    -- polynomial over the odds of WON legs.
    v_effective_n := v_total_count - v_void_count;
    v_effective_k := least(v_bet.system_size, greatest(v_effective_n,0));

    if v_effective_n = 0 or v_effective_k = 0 then
      v_new_status := 'lost';
      v_payout := 0;
    else
      for v_rec in select odds_price from public.bet_selections where bet_id = p_bet_id and status = 'won' loop
        v_won_odds := array_append(v_won_odds, v_rec.odds_price);
      end loop;

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

  perform public.fn_wallet_credit_bet_return(
    v_bet.user_id, v_payout, 'bet_payout', p_bet_id,
    initcap(v_new_status::text) || ' bet payout', v_bet.stake_from_principal
  );

  return jsonb_build_object('bet_id', p_bet_id, 'status', v_new_status, 'payout', v_payout);
end;
$$;

-- ---------- settle selection: cascade to the parent bet instantly ----------
create or replace function public.fn_settle_selection(p_selection_id uuid, p_status selection_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bet_id uuid;
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;

  if exists (
    select 1
    from public.bet_selections s
    join public.bets b on b.id = s.bet_id
    where s.id = p_selection_id and b.status <> 'open'
  ) then
    raise exception 'BET_ALREADY_SETTLED';
  end if;

  update public.bet_selections set status = p_status, settled_at = now() where id = p_selection_id
    returning bet_id into v_bet_id;

  -- If that grading decided the ticket (a loss, or the last pending leg),
  -- settle the bet in the same transaction -- no waiting for the cron.
  if (select status from public.bets where id = v_bet_id) = 'open' then
    perform public.fn_settle_bet(v_bet_id);
  end if;
end;
$$;

-- ---------- manual fixture settle: settle dead-or-resolved bets ----------
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
  v_res jsonb;
  v_settled_bets int := 0;
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

  -- Every open bet touching this fixture gets a settlement attempt --
  -- fn_settle_bet now resolves dead tickets early and harmlessly returns
  -- 'open' for bets still genuinely undecided.
  for v_bet in
    select distinct b.id
    from public.bets b
    join public.bet_selections bs on bs.bet_id = b.id
    where bs.fixture_id = p_fixture_id and b.status = 'open'
  loop
    v_res := public.fn_settle_bet(v_bet.id);
    if v_res ->> 'status' <> 'open' then
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

-- ---------- grants ----------
revoke execute on function public.fn_poisson_pmf(int, numeric) from public, anon;
revoke execute on function public.fn_leg_win_probability(uuid) from public, anon;
revoke execute on function public.fn_bet_cashout_quote(uuid) from public, anon;
grant execute on function public.fn_poisson_pmf(int, numeric) to service_role;
grant execute on function public.fn_leg_win_probability(uuid) to service_role;
grant execute on function public.fn_bet_cashout_quote(uuid) to service_role;
