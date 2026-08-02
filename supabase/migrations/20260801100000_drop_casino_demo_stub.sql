-- casino_demo_sessions / casino_demo_crash_rounds: an earlier abandoned
-- demo-mode crash-game prototype, applied directly to the database outside
-- the tracked migration history and never linked into the app. Empty
-- tables, no data loss -- dropped for the same reason as the rest of the
-- Spineazy casino stub (see 20260731100000_drop_casino_stub.sql).
drop table if exists public.casino_demo_crash_rounds;
drop table if exists public.casino_demo_sessions;
