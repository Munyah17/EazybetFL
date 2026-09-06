-- =====================================================================
-- Phone login was failing for real accounts ("Invalid credentials").
--
-- Cause: the signup normalizer only stripped leading zeros, so a user who
-- typed "263771234567" got "+263263771234567" stored (doubled country
-- code) and one who typed "77 123 4567" got "+26377 123 4567" (spaces
-- kept). fn_lookup_email_by_phone then did an exact string match against
-- the clean "+263771234567" the login form produces -> no row -> generic
-- "Invalid credentials", even though the account exists and the password
-- is right.
--
-- Fix: a proper normalizer, backfill existing rows to canonical form
-- (profiles.phone has a UNIQUE constraint, so this is done carefully),
-- and match on the normalized value at login. Server-side signup
-- normalization is in src/lib/phone.ts + the signup route.
-- =====================================================================

create or replace function public.fn_normalize_zw_phone(p_phone text)
returns text
language sql
immutable
as $$
  with s as (
    select regexp_replace(
             regexp_replace(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '^(263)+', ''),
             '^0+', ''
           ) as digits
  )
  select case when (select digits from s) ~ '^7\d{8}$'
              then '+263' || (select digits from s)
              else null end
$$;

do $$
declare
  r record;
begin
  -- 1. Synthetic test/throwaway accounts squatting a real user's number
  --    (e.g. an old E2E account on the founder's phone) -- drop their
  --    phone so the real account can own the number.
  update public.profiles
  set phone = null
  where phone is not null
    and (email ilike '%@eazybet.test' or email ilike '%@mailinator.com')
    and exists (
      select 1 from public.profiles p2
      where p2.id <> profiles.id
        and p2.phone is not null
        and right(regexp_replace(p2.phone, '\D', '', 'g'), 9) = right(regexp_replace(profiles.phone, '\D', '', 'g'), 9)
        and p2.email not ilike '%@eazybet.test'
        and p2.email not ilike '%@mailinator.com'
    );

  -- 2. Normalize each remaining phone to canonical form, one row at a
  --    time so a UNIQUE collision on one row can't abort the whole
  --    backfill. A row whose canonical form is already taken by another
  --    account is left as-is (last-9 matching at login still resolves it).
  for r in
    select id, phone, public.fn_normalize_zw_phone(phone) as canon
    from public.profiles
    where phone is not null
      and phone <> ''
      and public.fn_normalize_zw_phone(phone) is not null
      and phone <> public.fn_normalize_zw_phone(phone)
  loop
    if not exists (select 1 from public.profiles where phone = r.canon and id <> r.id) then
      update public.profiles set phone = r.canon where id = r.id;
    else
      raise notice 'phone backfill skipped for % -- canonical % already taken', r.id, r.canon;
    end if;
  end loop;
end $$;

-- Match on the normalized number, tolerant of however it was typed or
-- stored. Prefer an exact string hit, then the oldest account if two
-- somehow still share a number.
create or replace function public.fn_lookup_email_by_phone(p_phone text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select email
  from public.profiles
  where phone is not null
    and public.fn_normalize_zw_phone(p_phone) is not null
    and public.fn_normalize_zw_phone(phone) = public.fn_normalize_zw_phone(p_phone)
  order by (phone = p_phone) desc, created_at asc
  limit 1;
$$;

grant execute on function public.fn_lookup_email_by_phone(text) to anon, authenticated;
