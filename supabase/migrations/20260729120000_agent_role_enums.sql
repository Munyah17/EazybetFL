-- New enum values must land in their own migration/transaction --
-- Postgres won't let a value be used by anything in the same transaction
-- that adds it, so the columns/functions/policies that reference these
-- live in the next migration file instead.
alter type public.user_role add value 'agent';
alter type public.wallet_tx_type add value 'agent_deposit';
alter type public.wallet_tx_type add value 'agent_withdrawal';
alter type public.wallet_tx_type add value 'commission';
