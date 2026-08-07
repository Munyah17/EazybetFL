-- 10-digit account numbers were needlessly long and hard to read aloud
-- for an app this size. Switch to 1 letter + 4 digits (e.g. "K4821"),
-- randomly generated (not sequential -- an easily-guessed pattern like
-- A0001, A0002... would let scammers enumerate real accounts). Letters
-- exclude I/O to avoid confusion with 1/0, matching the existing
-- voucher-code character set.
create or replace function public.generate_account_number()
returns text
language plpgsql
as $$
declare
  letters text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_number text;
  exists_already boolean;
begin
  loop
    v_number := substr(letters, (floor(random() * length(letters)) + 1)::int, 1)
      || lpad(floor(random() * 10000)::text, 4, '0');
    select exists(select 1 from public.profiles where account_number = v_number) into exists_already;
    exit when not exists_already;
  end loop;
  return v_number;
end;
$$;

-- Regenerate every existing account number to the new short format --
-- one at a time (not a bulk UPDATE) so each generation sees the previous
-- iteration's assignment within this transaction and can't collide.
do $$
declare
  r record;
begin
  for r in select id from public.profiles loop
    update public.profiles set account_number = public.generate_account_number() where id = r.id;
  end loop;
end $$;

-- Account numbers now include a letter (always stored uppercase by the
-- generator above), so lookups need case-insensitive matching the same
-- way voucher codes already do -- a plain 10-digit number never needed
-- this, which is why it wasn't here before.
create or replace function public.fn_lookup_user_by_account_number(p_account_number text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  select * into v_profile from public.profiles where account_number = upper(trim(p_account_number));
  if not found then
    return null;
  end if;
  return jsonb_build_object('id', v_profile.id, 'full_name', v_profile.full_name);
end;
$$;

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

  select * into v_recipient from public.profiles where account_number = upper(trim(p_recipient_account_number));
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
  v_recipient public.profiles%rowtype;
  v_voucher_id uuid;
  v_code text;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;

  select * into v_recipient from public.profiles where account_number = upper(trim(p_recipient_account_number));
  if not found then raise exception 'RECIPIENT_NOT_FOUND'; end if;
  if v_recipient.id = v_user_id then raise exception 'CANNOT_TARGET_SELF'; end if;

  v_code := public.generate_voucher_code();
  insert into public.vouchers (code, amount, created_by)
  values (v_code, p_amount, v_user_id)
  returning id into v_voucher_id;

  perform public.fn_wallet_debit_spend(
    v_user_id, p_amount, 'voucher_gift', 'voucher', v_voucher_id, 'Gift voucher to ' || v_recipient.full_name
  );

  update public.vouchers set status = 'redeemed', redeemed_by = v_recipient.id, redeemed_at = now()
    where id = v_voucher_id;

  perform public.fn_wallet_credit(
    v_recipient.id, p_amount, 'voucher_redemption', 'voucher', v_voucher_id,
    'Voucher gift received', p_bucket := 'principal'
  );

  return jsonb_build_object('recipient_name', v_recipient.full_name, 'code', v_code);
end;
$$;
