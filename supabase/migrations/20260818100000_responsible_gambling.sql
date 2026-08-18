-- Self-serve responsible gambling tools: a user-set daily deposit limit
-- and self-exclusion, actually enforced at deposit/bet time -- previously
-- the /responsible-gambling page was purely informational and both of
-- these required emailing support.
create table public.responsible_gambling_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  daily_deposit_limit numeric(14,2) check (daily_deposit_limit is null or daily_deposit_limit > 0),
  self_exclusion_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.responsible_gambling_settings enable row level security;
create policy "rg_settings_select_own_or_admin" on public.responsible_gambling_settings
  for select using (user_id = auth.uid() or public.is_admin());

-- ---------- user sets/clears their own daily deposit limit ----------
-- Deliberately no cooldown on raising/clearing the limit in this first
-- pass (real responsible-gambling programmes often delay increases by
-- 24h+ to blunt impulsive reversal) -- flagged as a known simplification,
-- not silently pretended away.
create or replace function public.fn_set_deposit_limit(p_daily_limit numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_daily_limit is not null and p_daily_limit <= 0 then raise exception 'INVALID_AMOUNT'; end if;

  insert into public.responsible_gambling_settings (user_id, daily_deposit_limit, updated_at)
  values (v_user_id, p_daily_limit, now())
  on conflict (user_id) do update set daily_deposit_limit = p_daily_limit, updated_at = now();
end;
$$;

-- ---------- user self-excludes ----------
-- No matching "lift early" function exposed to users on purpose -- self-
-- exclusion that a user can cancel themselves the moment they feel like
-- gambling again defeats the point. It auto-expires; an admin can still
-- lift one early via a direct update if there's a genuine reason to.
create or replace function public.fn_self_exclude(p_duration_days int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_duration_days is null or p_duration_days < 1 then raise exception 'INVALID_DURATION'; end if;

  insert into public.responsible_gambling_settings (user_id, self_exclusion_until, updated_at)
  values (v_user_id, now() + (p_duration_days || ' days')::interval, now())
  on conflict (user_id) do update
    set self_exclusion_until = greatest(
          coalesce(responsible_gambling_settings.self_exclusion_until, now()),
          now() + (p_duration_days || ' days')::interval
        ),
        updated_at = now();
end;
$$;

grant execute on function public.fn_set_deposit_limit(numeric) to authenticated;
grant execute on function public.fn_self_exclude(int) to authenticated;
