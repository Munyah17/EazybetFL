-- Allow signing in with a phone number by resolving it to the account
-- email first (Supabase password auth is email-based; phone OTP would
-- need an SMS provider configured, which this project doesn't have yet).
-- Returns null for unknown numbers so the client shows a generic error
-- rather than confirming which phone numbers are registered.
create or replace function public.fn_lookup_email_by_phone(p_phone text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email from public.profiles where phone = p_phone limit 1;
$$;

revoke execute on function public.fn_lookup_email_by_phone(text) from public;
grant execute on function public.fn_lookup_email_by_phone(text) to anon, authenticated;
