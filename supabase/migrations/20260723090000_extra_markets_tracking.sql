-- Tracks when a fixture's "additional markets" (btts, double chance, draw no
-- bet, alternate spreads/totals) were last fetched from the per-event Odds
-- API endpoint. Separate from fixtures.last_synced_at (which the cheap bulk
-- h2h/spreads/totals sync updates) because the per-event endpoint is
-- expensive on quota -- we only want to call it on demand, per fixture, and
-- throttle repeat calls for the same fixture.
alter table public.fixtures add column if not exists extra_markets_synced_at timestamptz;
