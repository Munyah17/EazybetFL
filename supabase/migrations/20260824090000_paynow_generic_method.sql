-- Paynow's hosted checkout lets the payer pick their own instrument
-- (EcoCash, OneMoney, Visa, bank, etc.) after redirect -- we never actually
-- send it a pre-selected method. Pretending our own deposit screen could
-- choose "OneMoney" vs "Visa" ahead of that redirect was cosmetic and
-- inaccurate record-keeping (the deposit row's `method` didn't reflect what
-- Paynow's page actually processed). Add a single generic value so deposits
-- routed through Paynow's gateway are labeled honestly, separate from
-- EcoCash Instant Payment (`ecocash`), which is a direct, non-Paynow
-- integration and keeps its own distinct value.
alter type payment_method add value if not exists 'paynow';
