-- Retroactively apply the new sport/competition priority ordering to
-- already-synced rows, so the homepage reflects it immediately rather
-- than waiting for the next scheduled /api/sync/sports run (which now
-- assigns display_order the same way going forward). Mirrors the
-- priority tables in src/lib/odds-api/client.ts -- keep both in sync if
-- either changes.
update public.sport_groups set display_order = case name
  when 'Soccer' then 0
  when 'Basketball' then 1
  when 'Tennis' then 2
  when 'Cricket' then 3
  when 'Rugby Union' then 4
  when 'Rugby League' then 5
  when 'Boxing' then 6
  when 'Mixed Martial Arts' then 7
  when 'Golf' then 8
  when 'Ice Hockey' then 9
  when 'Handball' then 10
  when 'American Football' then 11
  when 'Baseball' then 12
  when 'Aussie Rules' then 13
  when 'Lacrosse' then 14
  else 20
end;

update public.competitions c set display_order = case
  when c.title = 'EPL' then 0
  when c.title = 'UEFA Champions League' then 1
  when c.title = 'La Liga - Spain' then 2
  when c.title = 'Serie A - Italy' then 3
  when c.title = 'Bundesliga - Germany' then 4
  when c.title = 'Ligue 1 - France' then 5
  when c.title = 'Dutch Eredivisie' then 6
  when c.title = 'Primeira Liga - Portugal' then 7
  when c.title = 'UEFA Europa League' then 8
  when c.title = 'UEFA Nations League' then 9
  when c.title = 'FIFA World Cup' then 10
  when c.title = 'UEFA Euro' then 11
  when c.title = 'Copa América' then 12
  when c.title = 'Copa Libertadores' then 13
  -- Non-soccer competitions keep sorting after all soccer ones via the
  -- sport_groups ordering above; give them a stable default here too.
  else 50
end;
