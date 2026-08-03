-- Bug fix: a RAISE EXCEPTION rolls back the whole transaction, including
-- the audit_logs insert that was supposed to survive it. The "blocked"
-- case isn't really an error anyway (nothing invalid was requested, a
-- policy just declined it) -- it's a normal return the client checks,
-- so the audit row commits along with everything else. All other error
-- paths (insufficient funds, recipient not found, etc.) still raise as
-- before -- nothing to log for those.
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
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;

  select * into v_recipient from public.profiles where account_number = trim(p_recipient_account_number);
  if not found then raise exception 'RECIPIENT_NOT_FOUND'; end if;
  if v_recipient.id = v_user_id then raise exception 'CANNOT_TARGET_SELF'; end if;

  select * into v_wallet from public.wallets where user_id = v_user_id for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;

  if v_wallet.balance < p_amount then
    if v_wallet.balance + v_wallet.principal_balance >= p_amount then
      select role into v_actor_role from public.profiles where id = v_user_id;
      insert into public.audit_logs (actor_id, actor_role, action, entity_type, new_values)
      values (
        v_user_id, v_actor_role, 'share_blocked_principal', 'wallet',
        jsonb_build_object('attempted_amount', p_amount, 'available_balance', v_wallet.balance, 'principal_balance', v_wallet.principal_balance)
      );
      return jsonb_build_object('blocked', true, 'reason', 'principal');
    end if;
    raise exception 'INSUFFICIENT_FUNDS';
  end if;

  perform public.fn_wallet_debit(
    v_user_id, p_amount, 'profit_share_sent', 'profit_share', v_recipient.id,
    coalesce('Sent to ' || v_recipient.full_name || case when p_note is not null then ': ' || p_note else '' end, 'Profit share sent'),
    p_bucket := 'balance'
  );
  perform public.fn_wallet_credit(
    v_recipient.id, p_amount, 'profit_share_received', 'profit_share', v_user_id,
    'Received from a fellow bettor' || case when p_note is not null then ': ' || p_note else '' end,
    p_bucket := 'balance'
  );

  return jsonb_build_object('blocked', false, 'recipient_name', v_recipient.full_name);
end;
$$;

-- Postgres won't let CREATE OR REPLACE change a function's return type
-- (uuid -> jsonb here) -- drop it first, which also drops its grants,
-- so those are re-applied below.
drop function if exists public.fn_request_withdrawal(numeric, payment_method, jsonb);

create function public.fn_request_withdrawal(
  p_amount numeric, p_method payment_method, p_destination jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_actor_role public.user_role;
  v_wallet public.wallets%rowtype;
  v_id uuid;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;

  select * into v_wallet from public.wallets where user_id = v_user_id for update;
  if not found then raise exception 'WALLET_NOT_FOUND'; end if;

  if v_wallet.balance < p_amount then
    if v_wallet.balance + v_wallet.principal_balance >= p_amount then
      select role into v_actor_role from public.profiles where id = v_user_id;
      insert into public.audit_logs (actor_id, actor_role, action, entity_type, new_values)
      values (
        v_user_id, v_actor_role, 'withdrawal_blocked_principal', 'wallet',
        jsonb_build_object('attempted_amount', p_amount, 'available_balance', v_wallet.balance, 'principal_balance', v_wallet.principal_balance)
      );
      return jsonb_build_object('blocked', true, 'reason', 'principal');
    end if;
    raise exception 'INSUFFICIENT_FUNDS';
  end if;

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

  return jsonb_build_object('blocked', false, 'withdrawal_id', v_id);
end;
$$;

grant execute on function public.fn_request_withdrawal(numeric, payment_method, jsonb) to authenticated;
