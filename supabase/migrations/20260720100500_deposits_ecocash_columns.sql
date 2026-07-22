-- Generalize deposits for multiple payment rails (Paynow + native EcoCash EIP).
alter table public.deposits
  add column if not exists provider text not null default 'paynow',
  add column if not exists client_correlator text unique,
  add column if not exists provider_transaction_id text;

create index if not exists idx_deposits_client_correlator on public.deposits(client_correlator);
