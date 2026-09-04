-- =====================================================================
-- Deposit verification hardening + manual "I paid but it's not showing"
-- request flow.
--
-- Two independent problems this addresses:
--
--  1. The result page polls /api/deposits/paynow/[id]/status, which until
--     now required a live session. Coming back from Paynow (EcoCash
--     in-app browser, Safari ITP cookie drop) the session is frequently
--     gone, so a fully-paid deposit could sit showing "still processing"
--     forever. `verify_token` is a per-deposit random string minted at
--     initiation and carried on the Paynow return URL, letting that one
--     deposit's status be polled without a session -- scoped to exactly
--     one deposit, leaks nothing.
--
--  2. When automated confirmation never lands (dead webhook, user closed
--     the tab before polling finished, Paynow flakiness), the player has
--     no recourse. `deposit_verification_requests` lets them submit the
--     EcoCash/Paynow confirmation details + a screenshot; a super admin
--     reviews and, on approval, the deposit is completed through the
--     exact same idempotent `fn_complete_deposit` path every other route
--     uses -- no separate crediting logic.
-- =====================================================================

-- ---------- per-deposit session-less status token ----------
alter table public.deposits
  add column if not exists verify_token text;

-- ---------- manual verification requests ----------
create table public.deposit_verification_requests (
  id uuid primary key default gen_random_uuid(),
  deposit_id uuid not null references public.deposits(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_claimed numeric(14,2),
  payer_phone text,
  payer_reference text,           -- reference from the EcoCash / Paynow confirmation SMS
  proof_path text,                -- object path in the private `deposit-proofs` bucket
  note text,                      -- free text from the player
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_dvr_status on public.deposit_verification_requests(status, created_at desc);
create index idx_dvr_deposit on public.deposit_verification_requests(deposit_id);
create index idx_dvr_user on public.deposit_verification_requests(user_id, created_at desc);

-- At most one open request per deposit -- a second "still not showing"
-- submission while the first is unreviewed is a no-op, not a new row.
create unique index uq_dvr_one_open_per_deposit
  on public.deposit_verification_requests(deposit_id)
  where status = 'pending';

alter table public.deposit_verification_requests enable row level security;

-- The player sees their own requests; a super admin sees all. (Plain
-- `is_admin()` deliberately excluded -- review is super-admin-only.)
create policy "dvr_select_own_or_super_admin" on public.deposit_verification_requests
  for select using (user_id = auth.uid() or public.is_super_admin());

-- The player may only file a request for a deposit that is actually
-- theirs. No update/delete policy: the player cannot mutate a request
-- once filed, and review happens through the SECURITY DEFINER RPC below.
create policy "dvr_insert_own" on public.deposit_verification_requests
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.deposits d
      where d.id = deposit_id and d.user_id = auth.uid()
    )
  );

-- ---------- private bucket for proof-of-payment uploads ----------
insert into storage.buckets (id, name, public)
values ('deposit-proofs', 'deposit-proofs', false)
on conflict (id) do nothing;

-- Objects are foldered by user id: `<user_id>/<file>`. A player may only
-- write into / read their own folder; super admins read everything.
drop policy if exists "deposit_proofs_insert_own" on storage.objects;
drop policy if exists "deposit_proofs_select_own" on storage.objects;

create policy "deposit_proofs_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'deposit-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "deposit_proofs_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'deposit-proofs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_super_admin()
    )
  );

-- ---------- super-admin review of a manual verification request ----------
create or replace function public.fn_review_deposit_verification(
  p_request_id uuid,
  p_approve boolean,
  p_admin_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.deposit_verification_requests%rowtype;
  v_admin uuid := auth.uid();
begin
  if not public.is_super_admin() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select * into v_req from public.deposit_verification_requests
    where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'ALREADY_REVIEWED';
  end if;

  if p_approve then
    -- Idempotent: returns early if the deposit already completed via any
    -- other path (webhook, poll, cron) between filing and review.
    perform public.fn_complete_deposit(v_req.deposit_id);
    update public.deposit_verification_requests
      set status = 'approved', admin_note = p_admin_note,
          reviewed_by = v_admin, reviewed_at = now()
      where id = p_request_id;
  else
    update public.deposit_verification_requests
      set status = 'rejected', admin_note = p_admin_note,
          reviewed_by = v_admin, reviewed_at = now()
      where id = p_request_id;
    -- Only move the deposit to `failed` if it is still unresolved -- never
    -- stomp a deposit that actually completed in the meantime.
    update public.deposits
      set status = 'failed'
      where id = v_req.deposit_id and status not in ('completed');
  end if;

  return jsonb_build_object(
    'request_id', p_request_id,
    'deposit_id', v_req.deposit_id,
    'status', case when p_approve then 'approved' else 'rejected' end
  );
end;
$$;

revoke execute on function public.fn_review_deposit_verification(uuid, boolean, text) from public;
grant execute on function public.fn_review_deposit_verification(uuid, boolean, text) to authenticated;
