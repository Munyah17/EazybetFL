-- Spineazy casino was never launched in-app (nav now links out to
-- https://spineasy.co.zw as a separate standalone product). Drop the
-- unused stub tables rather than carry dead schema forward.
drop table if exists public.casino_sessions;
drop table if exists public.casino_games;
drop type if exists casino_mode;
