-- =====================================================================
-- SECURITY: lock down internal money primitives.
--
-- fn_wallet_credit / fn_wallet_debit were recreated with an added
-- `p_bucket` arg in 20260802090200. A recreated function gets a fresh
-- default EXECUTE-to-PUBLIC grant, and the original REVOKE in
-- 20260720100300 named the *old* signature, so the 9-arg versions have
-- been callable by `anon` / `authenticated` ever since -- i.e. any logged
-- in user could mint or move wallet funds arbitrarily via a direct rpc()
-- call. Same exposure on fn_wallet_debit_spend, fn_house_escrow_stake,
-- fn_house_release_escrow, fn_check_rate_limit, and the bet-return helper.
--
-- These are never called from the client -- only from other SECURITY
-- DEFINER functions (which run as the owner and so are unaffected by
-- these revokes) and from server routes using the service-role key.
--
-- REVOKE from PUBLIC *and* explicitly from anon/authenticated, because
-- Supabase re-grants EXECUTE to those roles by default on new functions.
-- =====================================================================

do $$
declare
  fn text;
  fns text[] := array[
    'public.fn_wallet_credit(uuid, numeric, wallet_tx_type, text, uuid, text, wallet_tx_status, uuid, wallet_bucket)',
    'public.fn_wallet_debit(uuid, numeric, wallet_tx_type, text, uuid, text, wallet_tx_status, uuid, wallet_bucket)',
    'public.fn_wallet_debit_spend(uuid, numeric, wallet_tx_type, text, uuid, text)',
    'public.fn_wallet_credit_bet_return(uuid, numeric, wallet_tx_type, uuid, text, numeric)',
    'public.fn_house_escrow_stake(numeric, text, uuid, text)',
    'public.fn_house_release_escrow(numeric, numeric, text, uuid, text)',
    'public.fn_check_rate_limit(text, integer, integer)'
  ];
begin
  foreach fn in array fns loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;

-- Dead code from a different application (a school system) that was left
-- in this database. Guarded by a role no EazyBet profile has, so inert,
-- but it inserts straight into auth.users -- neuter its call surface.
-- (Not dropped outright in case a leftover RLS policy still references it.)
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_staff_member'
  ) then
    execute 'revoke execute on function public.create_staff_member(text, text, text, text, text, text, text, text) from public, anon, authenticated';
  end if;
end $$;
