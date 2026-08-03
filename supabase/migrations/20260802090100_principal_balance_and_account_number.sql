-- Deposited/voucher funds ("principal") must never be withdrawable or
-- shareable -- only money won from bets ("profit", the existing
-- `balance` column) can be. principal_balance is spendable on bet
-- stakes only.
alter table public.wallets add column principal_balance numeric(14,2) not null default 0 check (principal_balance >= 0);

-- Which bucket a ledger entry touched.
create type wallet_bucket as enum ('principal', 'balance');
alter table public.wallet_transactions add column bucket wallet_bucket not null default 'balance';

-- A short numeric ID every user can share so a friend can send them
-- profit or a gift voucher without needing phone/email.
alter table public.profiles add column account_number text unique;

create or replace function public.generate_account_number()
returns text
language plpgsql
as $$
declare
  v_number text;
  i int;
  exists_already boolean;
begin
  loop
    v_number := '';
    for i in 1..10 loop
      v_number := v_number || (floor(random() * 10))::int::text;
    end loop;
    select exists(select 1 from public.profiles where account_number = v_number) into exists_already;
    exit when not exists_already;
  end loop;
  return v_number;
end;
$$;

-- Backfill existing users one at a time (not a single bulk UPDATE) so
-- each call to generate_account_number() sees the previous iteration's
-- assignment within this transaction and can't collide with it.
do $$
declare
  r record;
begin
  for r in select id from public.profiles where account_number is null loop
    update public.profiles set account_number = public.generate_account_number() where id = r.id;
  end loop;
end $$;

alter table public.profiles alter column account_number set not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  v_code := 'EZ' || upper(substr(md5(new.id::text), 1, 6));

  insert into public.profiles (id, full_name, email, phone, referral_code, account_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''), '@', 1), 'EazyBet Player'),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', new.phone),
    v_code,
    public.generate_account_number()
  )
  on conflict (id) do nothing;

  insert into public.wallets (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
