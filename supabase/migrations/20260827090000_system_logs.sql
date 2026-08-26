-- Persistent, queryable error/warning log -- distinct from `audit_logs`
-- (which requires an authenticated actor and records privileged user
-- actions). This table is for the opposite case: server-side failures with
-- no acting user -- cron runs, webhooks, background sync, unhandled render
-- errors. Written exclusively via the service-role client (see
-- src/lib/log.ts), so there is deliberately no insert policy for
-- authenticated/anon -- only the server can create entries, only a super
-- admin can read or resolve them.
create table public.system_logs (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('error', 'warn')),
  source text not null,
  message text not null,
  context jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_system_logs_created on public.system_logs(created_at desc);
create index idx_system_logs_unresolved on public.system_logs(resolved_at) where resolved_at is null;

alter table public.system_logs enable row level security;

create policy "system_logs_select_super_admin" on public.system_logs
  for select using (public.is_super_admin());

-- Marking an entry reviewed is a low-stakes toggle, not a money-moving
-- action -- a direct RLS-gated update is fine here, no RPC indirection
-- needed the way audit_logs writes go through fn_write_audit_log.
create policy "system_logs_update_super_admin" on public.system_logs
  for update using (public.is_super_admin()) with check (public.is_super_admin());
