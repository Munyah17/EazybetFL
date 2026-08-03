-- Extend the wallet credit/debit primitives with a bucket (principal vs
-- balance) so every existing call site keeps working unchanged (default
-- 'balance', same as before) while deposit/voucher/bet-stake paths can
-- now target principal_balance specifically.
create or replace function public.fn_wallet_credit(
  p_user_id uuid,
  p_amount numeric,
  p_type wallet_tx_type,
  p_reference_type text,
  p_reference_id uuid,
  p_description text,
  p_status wallet_tx_status default 'completed',
  p_created_by uuid default null,
  p_bucket wallet_bucket default 'balance'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.wallets%rowtype;
  v_tx_id uuid;
  v_before numeric;
  v_after numeric;
begin
  select * into v_wallet from public.wallets where user_id = p_user_id for update;
  if not found then
    raise exception 'WALLET_NOT_FOUND';
  end if;

  if p_bucket = 'principal' then
    v_before := v_wallet.principal_balance;
    update public.wallets set principal_balance = principal_balance + p_amount, updated_at = now()
      where user_id = p_user_id returning principal_balance into v_after;
  else
    v_before := v_wallet.balance;
    update public.wallets set balance = balance + p_amount, updated_at = now()
      where user_id = p_user_id returning balance into v_after;
  end if;

  insert into public.wallet_transactions (
    wallet_id, user_id, type, status, amount, balance_before, balance_after,
    reference_type, reference_id, description, created_by, bucket
  ) values (
    v_wallet.id, p_user_id, p_type, p_status, p_amount, v_before, v_after,
    p_reference_type, p_reference_id, p_description, p_created_by, p_bucket
  ) returning id into v_tx_id;

  return v_tx_id;
end;
$$;

create or replace function public.fn_wallet_debit(
  p_user_id uuid,
  p_amount numeric,
  p_type wallet_tx_type,
  p_reference_type text,
  p_reference_id uuid,
  p_description text,
  p_status wallet_tx_status default 'completed',
  p_created_by uuid default null,
  p_bucket wallet_bucket default 'balance'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.wallets%rowtype;
  v_tx_id uuid;
  v_before numeric;
  v_after numeric;
begin
  select * into v_wallet from public.wallets where user_id = p_user_id for update;
  if not found then
    raise exception 'WALLET_NOT_FOUND';
  end if;

  if p_bucket = 'principal' then
    if v_wallet.principal_balance < p_amount then
      raise exception 'INSUFFICIENT_FUNDS';
    end if;
    v_before := v_wallet.principal_balance;
    update public.wallets set principal_balance = principal_balance - p_amount, updated_at = now()
      where user_id = p_user_id returning principal_balance into v_after;
  else
    if v_wallet.balance < p_amount then
      raise exception 'INSUFFICIENT_FUNDS';
    end if;
    v_before := v_wallet.balance;
    update public.wallets set balance = balance - p_amount, updated_at = now()
      where user_id = p_user_id returning balance into v_after;
  end if;

  insert into public.wallet_transactions (
    wallet_id, user_id, type, status, amount, balance_before, balance_after,
    reference_type, reference_id, description, created_by, bucket
  ) values (
    v_wallet.id, p_user_id, p_type, p_status, -p_amount, v_before, v_after,
    p_reference_type, p_reference_id, p_description, p_created_by, p_bucket
  ) returning id into v_tx_id;

  return v_tx_id;
end;
$$;

-- ---------- spend from combined funds, principal first ----------
-- Used anywhere a user *spends* money (bet stakes, gifting a voucher) --
-- as opposed to withdrawing/sharing it, spending is fine regardless of
-- source since it never lets principal leave the platform as cash.
create or replace function public.fn_wallet_debit_spend(
  p_user_id uuid,
  p_amount numeric,
  p_type wallet_tx_type,
  p_reference_type text,
  p_reference_id uuid,
  p_description text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.wallets%rowtype;
  v_from_principal numeric;
  v_from_balance numeric;
begin
  select * into v_wallet from public.wallets where user_id = p_user_id for update;
  if not found then
    raise exception 'WALLET_NOT_FOUND';
  end if;
  if v_wallet.principal_balance + v_wallet.balance < p_amount then
    raise exception 'INSUFFICIENT_FUNDS';
  end if;

  v_from_principal := least(p_amount, v_wallet.principal_balance);
  v_from_balance := p_amount - v_from_principal;

  if v_from_principal > 0 then
    perform public.fn_wallet_debit(
      p_user_id, v_from_principal, p_type, p_reference_type, p_reference_id, p_description,
      p_bucket := 'principal'
    );
  end if;
  if v_from_balance > 0 then
    perform public.fn_wallet_debit(
      p_user_id, v_from_balance, p_type, p_reference_type, p_reference_id, p_description,
      p_bucket := 'balance'
    );
  end if;
end;
$$;

revoke execute on function public.fn_wallet_debit_spend(uuid, numeric, wallet_tx_type, text, uuid, text) from public;
grant execute on function public.fn_wallet_debit_spend(uuid, numeric, wallet_tx_type, text, uuid, text) to service_role;
