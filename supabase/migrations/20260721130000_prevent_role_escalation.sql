-- RLS's "profiles_update_admin" policy lets any admin update any profile
-- row, but it can't restrict *which columns* -- without this trigger a
-- level-2 admin could call `.update({ role: 'super_admin' })` directly
-- from the browser and self-escalate. Level-2 admins may still suspend
-- / reactivate accounts (status), but only a super_admin may change
-- `role`.
create or replace function public.fn_guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if not public.is_super_admin() then
      raise exception 'NOT_AUTHORIZED: only a super admin can change role';
    end if;
  end if;
  if new.status is distinct from old.status then
    if not public.is_admin() then
      raise exception 'NOT_AUTHORIZED: only an admin can change status';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_guard_profile_privileges
  before update on public.profiles
  for each row execute function public.fn_guard_profile_privileges();
