-- Platform-level (not tied to any admin's personal wallet) escrow +
-- house reserve, so bet money is explicitly accounted for instead of
-- implicitly vanishing/appearing on the user side only. Singleton row,
-- referenced by a fixed well-known id.
create table public.house_ledger (
  id uuid primary key default gen_random_uuid(),
  -- Sum of all currently-open bets' stakes -- always >= 0 by construction.
  escrow_balance numeric(14,2) not null default 0 check (escrow_balance >= 0),
  -- Platform reserve: += stakes lost, -= payouts funded above stake. Not
  -- constrained to >= 0 -- an early large win before enough volume has
  -- accrued can legitimately put this negative; that's a real signal to
  -- top up reserve capital, not a bug to block on.
  house_balance numeric(14,2) not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.house_ledger (id) values ('00000000-0000-0000-0000-000000000001');

create type house_ledger_tx_type as enum (
  'stake_escrowed', 'stake_lost_to_house', 'payout_funded_by_house', 'stake_refunded_from_escrow'
);

create table public.house_ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  type house_ledger_tx_type not null,
  amount numeric(14,2) not null,
  escrow_balance_before numeric(14,2) not null,
  escrow_balance_after numeric(14,2) not null,
  house_balance_before numeric(14,2) not null,
  house_balance_after numeric(14,2) not null,
  reference_type text,
  reference_id uuid,
  description text,
  created_at timestamptz not null default now()
);
create index idx_house_ledger_tx_reference on public.house_ledger_transactions(reference_type, reference_id);
create index idx_house_ledger_tx_created on public.house_ledger_transactions(created_at desc);

alter table public.house_ledger enable row level security;
alter table public.house_ledger_transactions enable row level security;
create policy "house_ledger_select_super_admin" on public.house_ledger
  for select using (public.is_super_admin());
create policy "house_ledger_tx_select_super_admin" on public.house_ledger_transactions
  for select using (public.is_super_admin());

-- ---------- move a newly-placed bet's stake into escrow ----------
create or replace function public.fn_house_escrow_stake(
  p_amount numeric, p_reference_type text, p_reference_id uuid, p_description text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ledger public.house_ledger%rowtype;
begin
  select * into v_ledger from public.house_ledger where id = '00000000-0000-0000-0000-000000000001' for update;

  update public.house_ledger
    set escrow_balance = escrow_balance + p_amount, updated_at = now()
    where id = v_ledger.id
    returning * into v_ledger;

  insert into public.house_ledger_transactions (
    type, amount, escrow_balance_before, escrow_balance_after, house_balance_before, house_balance_after,
    reference_type, reference_id, description
  ) values (
    'stake_escrowed', p_amount, v_ledger.escrow_balance - p_amount, v_ledger.escrow_balance,
    v_ledger.house_balance, v_ledger.house_balance, p_reference_type, p_reference_id, p_description
  );
end;
$$;

-- ---------- release an escrowed stake at settlement/cash-out time ----------
-- p_stake is the amount originally escrowed for this bet; p_user_payout is
-- what the user actually receives (0 if lost). The difference flows
-- to/from the house reserve: house gains when payout < stake, funds the
-- gap when payout > stake.
create or replace function public.fn_house_release_escrow(
  p_stake numeric, p_user_payout numeric, p_reference_type text, p_reference_id uuid, p_description text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ledger public.house_ledger%rowtype;
  v_house_delta numeric;
  v_tx_type public.house_ledger_tx_type;
begin
  select * into v_ledger from public.house_ledger where id = '00000000-0000-0000-0000-000000000001' for update;

  v_house_delta := p_stake - p_user_payout;
  v_tx_type := case
    when v_house_delta > 0 then 'stake_lost_to_house'
    when v_house_delta < 0 then 'payout_funded_by_house'
    else 'stake_refunded_from_escrow'
  end;

  update public.house_ledger
    set escrow_balance = escrow_balance - p_stake,
        house_balance = house_balance + v_house_delta,
        updated_at = now()
    where id = v_ledger.id
    returning * into v_ledger;

  insert into public.house_ledger_transactions (
    type, amount, escrow_balance_before, escrow_balance_after, house_balance_before, house_balance_after,
    reference_type, reference_id, description
  ) values (
    v_tx_type, v_house_delta, v_ledger.escrow_balance + p_stake, v_ledger.escrow_balance,
    v_ledger.house_balance - v_house_delta, v_ledger.house_balance, p_reference_type, p_reference_id, p_description
  );
end;
$$;

revoke execute on function public.fn_house_escrow_stake(numeric, text, uuid, text) from public;
revoke execute on function public.fn_house_release_escrow(numeric, numeric, text, uuid, text) from public;
grant execute on function public.fn_house_escrow_stake(numeric, text, uuid, text) to service_role;
grant execute on function public.fn_house_release_escrow(numeric, numeric, text, uuid, text) to service_role;
