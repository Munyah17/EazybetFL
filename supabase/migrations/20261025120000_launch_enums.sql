-- =====================================================================
-- Launch-day enum extensions.
--
-- New enum values must land in their own migration -- Postgres refuses to
-- use a value added by ALTER TYPE inside the same transaction. Everything
-- that references these values lives in 20261025120100_launch_fixes.sql.
--
-- wallet_bucket:
--   'voucher'  -- cash-bought voucher money. Physically credits
--               principal_balance (bet-only, like a deposit) but stays
--               distinguishable in the ledger.
--   'bonus'    -- house-funded promo money. Physically credits
--               bonus_balance. Spendable on bets, never withdrawable.
--
-- deposit_status:
--   'reversed' -- a completed deposit an admin clawed back.
-- =====================================================================

alter type public.wallet_bucket add value 'bonus';
alter type public.wallet_bucket add value 'voucher';
alter type public.deposit_status add value 'reversed';
