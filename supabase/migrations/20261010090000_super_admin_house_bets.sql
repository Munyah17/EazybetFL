-- =====================================================================
-- House-funded super admin spend ("infinite wallet", fully reconciled).
--
-- A super_admin's wallet is never the constraint: bet placement, profit
-- share and voucher gifting all skip the balance check AND the wallet
-- debit. But nothing is silent -- the money trail stays on the books:
--
--   BETS: the stake is still escrowed through house_ledger exactly like
--   a paid bet (stake_escrowed -> stake_lost_to_house /
--   payout_funded_by_house), and the bet row is stamped is_free_bet =
--   true. Settlement/cash-out skips the wallet credit -- the payout
--   returns to the house, so a zero-funded ticket can never mint real
--   withdrawable balance. Agent commission is skipped too: house-funded
--   turnover is not real turnover.
--
--   SHARE / GIFT: the recipient is credited normally (that part is real
--   money by design) and an audit_logs row records the house-funded
--   send instead of a debit transaction the balance check can't hold.
--
-- is_free_bet existed since the core schema but was never written; it
-- now means "funded by the house" -- which also covers promotional free
-- bets if they're ever introduced.
--
-- fn_reconcile_ledger gains a house_bets summary plus a check that no
-- house bet ever touched a wallet bucket.
-- =====================================================================

-- ---------- place bet: super_admin stakes are house-funded ----------
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

  -- Super admin stakes are funded by the house, not the wallet. Everything
  -- else (escrow, settlement, reporting) runs identically so the ticket is
  -- indistinguishable from a paid one on the books -- apart from the
  -- is_free_bet flag and the absent wallet debit.
  v_house_funded := v_caller_role = 'super_admin';

  -- ===== SINGLE: one independent bet per selection, each staked p_stake =====
  if p_bet_type = 'single' then
    if not v_house_funded and v_wallet.principal_balance + v_wallet.balance < p_stake * v_count then
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
          set stake_from_principal = (v_split->>'from_principal')::numeric,
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
  if not v_house_funded and v_wallet.principal_balance + v_wallet.balance < p_stake then
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
      set stake_from_principal = (v_split->>'from_principal')::numeric,
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

-- ---------- cash out: house-funded tickets pay the house, not the wallet ----------
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

  -- House-funded: the cash-out value returns to the house reserve via the
  -- escrow release above -- crediting the wallet would mint real
  -- withdrawable money from a stake nobody paid.
  if not v_bet.is_free_bet then
    perform public.fn_wallet_credit_bet_return(
      v_user_id, v_cash_value, 'cashout', p_bet_id, 'Cash out payout', v_bet.stake_from_principal
    );
  end if;

  return jsonb_build_object('bet_id', p_bet_id, 'cash_out_value', v_cash_value);
end;
$$;

-- ---------- settle bet: house-funded tickets pay the house, not the wallet ----------
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

  -- House-funded: the payout stays in the house reserve -- the escrow
  -- release above already recorded it. Crediting the wallet here would
  -- mint real withdrawable balance from a stake nobody paid.
  if not v_bet.is_free_bet then
    perform public.fn_wallet_credit_bet_return(
      v_bet.user_id, v_payout, 'bet_payout', p_bet_id,
      initcap(v_new_status::text) || ' bet payout', v_bet.stake_from_principal
    );
  end if;

  return jsonb_build_object('bet_id', p_bet_id, 'status', v_new_status, 'payout', v_payout);
end;
$$;

-- ---------- profit share: super_admin sends are house-funded ----------
create or replace function public.fn_share_profit(
  p_recipient_account_number text,
  p_amount numeric,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_actor_role public.user_role;
  v_recipient public.profiles%rowtype;
  v_wallet public.wallets%rowtype;
  v_note text := left(coalesce(p_note, ''), 140);
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.fn_check_rate_limit('share:' || v_user_id::text, 20, 60) then
    raise exception 'RATE_LIMITED';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;

  select * into v_recipient from public.profiles where account_number = trim(p_recipient_account_number);
  if not found then raise exception 'RECIPIENT_NOT_FOUND'; end if;
  if v_recipient.id = v_user_id then raise exception 'CANNOT_TARGET_SELF'; end if;

  select role into v_actor_role from public.profiles where id = v_user_id;

  -- House-funded send: no balance check, no debit (the wallet can't go
  -- negative anyway) -- an audit row carries the accountability instead.
  if v_actor_role <> 'super_admin' then
    select * into v_wallet from public.wallets where user_id = v_user_id for update;
    if not found then raise exception 'WALLET_NOT_FOUND'; end if;

    if v_wallet.balance < p_amount then
      if v_wallet.balance + v_wallet.principal_balance >= p_amount then
        insert into public.audit_logs (actor_id, actor_role, action, entity_type, new_values)
        values (
          v_user_id, v_actor_role, 'share_blocked_principal', 'wallet',
          jsonb_build_object('attempted_amount', p_amount, 'available_balance', v_wallet.balance, 'principal_balance', v_wallet.principal_balance)
        );
        raise exception 'SHARE_BLOCKED_PRINCIPAL';
      end if;
      raise exception 'INSUFFICIENT_FUNDS';
    end if;

    perform public.fn_wallet_debit(
      v_user_id, p_amount, 'profit_share_sent', 'profit_share', v_recipient.id,
      coalesce('Sent to ' || v_recipient.full_name || case when v_note <> '' then ': ' || v_note else '' end, 'Profit share sent'),
      p_bucket := 'balance'
    );
  else
    insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, new_values)
    values (
      v_user_id, v_actor_role, 'share_house_funded', 'profile', v_recipient.id,
      jsonb_build_object('amount', p_amount, 'recipient_name', v_recipient.full_name, 'note', v_note)
    );
  end if;

  perform public.fn_wallet_credit(
    v_recipient.id, p_amount, 'profit_share_received', 'profit_share', v_user_id,
    'Received from a fellow bettor' || case when v_note <> '' then ': ' || v_note else '' end,
    p_bucket := 'balance'
  );

  return jsonb_build_object('recipient_name', v_recipient.full_name);
end;
$$;

-- ---------- voucher gifting: super_admin gifts are house-funded ----------
create or replace function public.fn_gift_voucher(
  p_recipient_account_number text,
  p_amount numeric
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_actor_role public.user_role;
  v_recipient public.profiles%rowtype;
  v_voucher_id uuid;
  v_code text;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.fn_check_rate_limit('gift:' || v_user_id::text, 20, 60) then
    raise exception 'RATE_LIMITED';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;

  select * into v_recipient from public.profiles where account_number = trim(p_recipient_account_number);
  if not found then raise exception 'RECIPIENT_NOT_FOUND'; end if;
  if v_recipient.id = v_user_id then raise exception 'CANNOT_TARGET_SELF'; end if;

  v_code := public.generate_voucher_code();
  insert into public.vouchers (code, amount, created_by)
  values (v_code, p_amount, v_user_id)
  returning id into v_voucher_id;

  select role into v_actor_role from public.profiles where id = v_user_id;
  if v_actor_role <> 'super_admin' then
    perform public.fn_wallet_debit_spend(
      v_user_id, p_amount, 'voucher_gift', 'voucher', v_voucher_id, 'Gift voucher to ' || v_recipient.full_name
    );
  else
    insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, new_values)
    values (
      v_user_id, v_actor_role, 'voucher_gift_house_funded', 'voucher', v_voucher_id,
      jsonb_build_object('amount', p_amount, 'recipient_id', v_recipient.id, 'recipient_name', v_recipient.full_name)
    );
  end if;

  update public.vouchers set status = 'redeemed', redeemed_by = v_recipient.id, redeemed_at = now()
    where id = v_voucher_id;

  perform public.fn_wallet_credit(
    v_recipient.id, p_amount, 'voucher_redemption', 'voucher', v_voucher_id,
    'Voucher gift received', p_bucket := 'principal'
  );

  return jsonb_build_object('recipient_name', v_recipient.full_name, 'code', v_code);
end;
$$;

-- ---------- ledger reconciliation (super admin) ----------
-- Proves the books balance. Returns a list of anomalies -- an empty list
-- means every cent is accounted for. Read-only; safe to run any time.
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

  -- 1. house escrow balance must equal the sum of all open bet stakes
  select escrow_balance, house_balance into v_escrow_ledger, v_house
    from public.house_ledger where id = '00000000-0000-0000-0000-000000000001';
  select coalesce(sum(stake), 0) into v_escrow_open from public.bets where status = 'open';
  if coalesce(v_escrow_ledger, 0) <> v_escrow_open then
    v_anomalies := v_anomalies || jsonb_build_object(
      'check', 'escrow_vs_open_stakes',
      'ledger_escrow', v_escrow_ledger, 'sum_open_stakes', v_escrow_open,
      'diff', coalesce(v_escrow_ledger, 0) - v_escrow_open);
  end if;

  -- 2. every wallet's principal/balance must equal its non-reversed ledger sum
  select count(*) into v_bad_buckets from (
    select w.id
    from public.wallets w
    left join (
      select wallet_id,
        coalesce(sum(amount) filter (where bucket = 'balance'), 0) as bal,
        coalesce(sum(amount) filter (where bucket = 'principal'), 0) as prin
      from public.wallet_transactions
      where status <> 'reversed'
      group by wallet_id
    ) t on t.wallet_id = w.id
    where w.balance <> coalesce(t.bal, 0)
       or w.principal_balance <> coalesce(t.prin, 0)
  ) x;
  if v_bad_buckets > 0 then
    v_anomalies := v_anomalies || jsonb_build_object(
      'check', 'wallet_buckets_vs_ledger', 'wallets_out_of_balance', v_bad_buckets);
  end if;

  -- 3. every wallet's locked_balance must equal its pending withdrawals
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

  -- 4. a house-funded bet must never have touched a wallet bucket --
  --    any stake_from_* value on one means the bypass leaked real money.
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

revoke execute on function public.fn_reconcile_ledger() from public;
grant execute on function public.fn_reconcile_ledger() to authenticated;
