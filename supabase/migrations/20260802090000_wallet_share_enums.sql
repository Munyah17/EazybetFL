-- New enum values must land in their own migration/transaction -- Postgres
-- won't let a value be used by anything in the same transaction that adds
-- it, so the functions that reference these live in later migrations.
alter type public.wallet_tx_type add value 'voucher_gift';
alter type public.wallet_tx_type add value 'profit_share_sent';
alter type public.wallet_tx_type add value 'profit_share_received';
