-- The sync routes did delete-then-insert for odds_outcomes per market,
-- which is not atomic across two overlapping requests -- both could delete
-- (no-op on the second) then both insert, doubling rows. Clean up any
-- existing duplicates and add a real uniqueness constraint so the app can
-- upsert idempotently instead of relying on delete+insert timing.

-- For each duplicate group (same market_id/name/point), pick a single
-- "keeper" (most recently updated, ties broken by id) and repoint any
-- bet_selections referencing a non-keeper row in that group to the keeper
-- before removing the duplicates -- those rows can be real historical bets
-- and must not lose their outcome reference.
with ranked as (
  select
    id,
    market_id,
    name,
    point,
    first_value(id) over (
      partition by market_id, name, point
      order by updated_at desc, id desc
    ) as keeper_id
  from public.odds_outcomes
),
dupes as (
  select id, keeper_id from ranked where id <> keeper_id
)
update public.bet_selections bs
set outcome_id = d.keeper_id
from dupes d
where bs.outcome_id = d.id;

with ranked as (
  select
    id,
    market_id,
    name,
    point,
    first_value(id) over (
      partition by market_id, name, point
      order by updated_at desc, id desc
    ) as keeper_id
  from public.odds_outcomes
)
delete from public.odds_outcomes o
using ranked r
where o.id = r.id and r.id <> r.keeper_id;

-- NULLS NOT DISTINCT: most of our markets (h2h, btts, double_chance,
-- draw_no_bet) have point = NULL for every outcome, and standard SQL
-- unique constraints treat NULLs as distinct from each other -- without
-- this, duplicate (market_id, name, NULL) rows would still slip through.
alter table public.odds_outcomes
  add constraint odds_outcomes_market_name_point_key unique nulls not distinct (market_id, name, point);
