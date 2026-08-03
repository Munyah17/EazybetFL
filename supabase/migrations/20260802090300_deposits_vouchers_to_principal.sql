-- Deposits and voucher redemptions credit principal_balance (bet-only)
-- instead of balance (withdrawable/shareable) -- only winnings should
-- ever land in balance.
create or replace function public.fn_complete_deposit(p_deposit_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_d public.deposits%rowtype;
begin
  select * into v_d from public.deposits where id = p_deposit_id for update;
  if not found then raise exception 'DEPOSIT_NOT_FOUND'; end if;
  if v_d.status = 'completed' then return; end if;

  update public.deposits set status = 'completed', completed_at = now() where id = p_deposit_id;

  perform public.fn_wallet_credit(
    v_d.user_id, v_d.amount, 'deposit', 'deposit', p_deposit_id, 'Deposit via ' || v_d.method::text,
    p_bucket := 'principal'
  );
end;
$$;

create or replace function public.fn_redeem_voucher(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_voucher public.vouchers%rowtype;
  v_wallet public.wallets%rowtype;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select * into v_voucher from public.vouchers where code = upper(trim(p_code)) for update;
  if not found then raise exception 'VOUCHER_NOT_FOUND'; end if;
  if v_voucher.status = 'redeemed' then raise exception 'VOUCHER_ALREADY_REDEEMED'; end if;
  if v_voucher.status = 'void' then raise exception 'VOUCHER_VOID'; end if;
  if v_voucher.expires_at is not null and v_voucher.expires_at < now() then
    raise exception 'VOUCHER_EXPIRED';
  end if;

  update public.vouchers
    set status = 'redeemed', redeemed_by = v_user_id, redeemed_at = now()
    where id = v_voucher.id;

  perform public.fn_wallet_credit(
    v_user_id, v_voucher.amount, 'voucher_redemption', 'voucher', v_voucher.id,
    'Voucher redeemed: ' || v_voucher.code,
    p_bucket := 'principal'
  );

  select * into v_wallet from public.wallets where user_id = v_user_id;

  return jsonb_build_object('amount', v_voucher.amount, 'new_balance', v_wallet.principal_balance);
end;
$$;
