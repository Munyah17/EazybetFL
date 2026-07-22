-- Server-side jobs (score sync / settlement) call fn_settle_bet etc. using
-- the service role key with no end-user JWT, so auth.uid() is null there.
-- Let is_admin()/is_super_admin() recognize the service_role itself as
-- privileged, in addition to the existing profiles.role check.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.role() = 'service_role' or exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','super_admin')
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.role() = 'service_role' or exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;
