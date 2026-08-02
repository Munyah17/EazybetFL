-- New enum value must land in its own migration/transaction -- Postgres
-- won't let a value be used by anything in the same transaction that adds
-- it, so the table/function referencing it lives in the next migration.
alter type public.wallet_tx_type add value 'voucher_redemption';
