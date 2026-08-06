-- CRITICAL FIX: adding a trailing default parameter (p_bucket) to
-- fn_wallet_credit/fn_wallet_debit via CREATE OR REPLACE did not replace
-- the original 8-arg functions as intended -- Postgres treats a
-- different parameter count as a distinct overload, so both the old
-- 8-arg and new 9-arg versions have been coexisting. Any caller passing
-- 6-8 positional args without explicitly naming p_bucket has been
-- hitting "function is not unique" ever since (bet settlement payouts,
-- cash-outs, agent cash deposits/withdrawals, commission credits --
-- anything that didn't explicitly write p_bucket := ...).
-- Drop the stale 8-arg originals so every call unambiguously resolves
-- to the single 9-arg version (p_bucket defaults to 'balance', so
-- existing callers behave exactly as before).
drop function if exists public.fn_wallet_credit(uuid, numeric, wallet_tx_type, text, uuid, text, wallet_tx_status, uuid);
drop function if exists public.fn_wallet_debit(uuid, numeric, wallet_tx_type, text, uuid, text, wallet_tx_status, uuid);
