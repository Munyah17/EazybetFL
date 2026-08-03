-- Same as the original fn_request_withdrawal, except a request that
-- would have to dip into deposited principal to be covered is blocked
-- and logged (rather than silently allowed like a normal withdrawal).
create or replace function public.fn_request_withdrawal(
  p_amount numeric, p_method payment_method, p_destination jsonb
) returns uuid
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
      raise exception 'WITHDRAWAL_BLOCKED_PRINCIPAL';
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

  return v_id;
end;
$$;
