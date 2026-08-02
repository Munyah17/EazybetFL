-- Redeemable cash vouchers: admins generate a batch of codes (sold on by
-- agents or in-store), a user redeems a code once from their account and
-- the value is credited straight to their wallet.

create type voucher_status as enum ('active', 'redeemed', 'void');

create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  amount numeric(14,2) not null check (amount > 0),
  status voucher_status not null default 'active',
  created_by uuid not null references public.profiles(id),
  redeemed_by uuid references public.profiles(id),
  redeemed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_vouchers_status on public.vouchers(status);
create index idx_vouchers_redeemed_by on public.vouchers(redeemed_by);
create index idx_vouchers_created_by on public.vouchers(created_by);

alter table public.vouchers enable row level security;

create policy "vouchers_select_own_or_admin" on public.vouchers
  for select using (redeemed_by = auth.uid() or created_by = auth.uid() or public.is_admin());

-- ---------- voucher code generator (mirrors generate_bet_code, longer since
-- a voucher code is a bearer instrument of real money) ----------
create or replace function public.generate_voucher_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  i int;
  exists_already boolean;
begin
  loop
    v_code := 'EZV';
    for i in 1..12 loop
      v_code := v_code || substr(chars, (floor(random() * length(chars)) + 1)::int, 1);
    end loop;
    select exists(select 1 from public.vouchers where code = v_code) into exists_already;
    exit when not exists_already;
  end loop;
  return v_code;
end;
$$;

-- ---------- admin: generate a batch of vouchers ----------
create or replace function public.fn_generate_vouchers(
  p_amount numeric,
  p_count int default 1,
  p_expires_at timestamptz default null
) returns setof public.vouchers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  i int;
  v_row public.vouchers%rowtype;
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_count is null or p_count < 1 or p_count > 100 then raise exception 'INVALID_COUNT'; end if;

  for i in 1..p_count loop
    insert into public.vouchers (code, amount, created_by, expires_at)
    values (public.generate_voucher_code(), p_amount, v_admin, p_expires_at)
    returning * into v_row;
    return next v_row;
  end loop;
  return;
end;
$$;

-- ---------- admin: void an unredeemed voucher (lost/misprinted) ----------
create or replace function public.fn_void_voucher(p_voucher_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  update public.vouchers set status = 'void' where id = p_voucher_id and status = 'active';
  if not found then raise exception 'VOUCHER_NOT_FOUND'; end if;
end;
$$;

-- ---------- user: redeem a voucher into their own wallet ----------
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
    'Voucher redeemed: ' || v_voucher.code
  );

  select * into v_wallet from public.wallets where user_id = v_user_id;

  return jsonb_build_object('amount', v_voucher.amount, 'new_balance', v_wallet.balance);
end;
$$;

grant execute on function public.generate_voucher_code() to authenticated;
grant execute on function public.fn_generate_vouchers(numeric, int, timestamptz) to authenticated;
grant execute on function public.fn_void_voucher(uuid) to authenticated;
grant execute on function public.fn_redeem_voucher(text) to authenticated;
