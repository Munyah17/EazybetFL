import { createClient } from "@/lib/supabase/server";
import type { FixtureWithOdds } from "@/lib/data/fixture-types";
import type { Database } from "@/types/database";

export type { FixtureWithOdds } from "@/lib/data/fixture-types";
export { h2hOutcomes } from "@/lib/data/fixture-types";

type FixtureStatus = Database["public"]["Enums"]["fixture_status"];

const FIXTURE_SELECT = `
  id, home_team, away_team, commence_time, status, home_score, away_score, minute,
  competition:competitions ( id, title, sport_group:sport_groups ( id, key, name, icon ) ),
  markets ( id, market_key, market_name, status, odds_outcomes ( id, name, point, price, display_order ) )
`;

export async function getFixtureById(id: string): Promise<FixtureWithOdds | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("fixtures").select(FIXTURE_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as FixtureWithOdds) ?? null;
}

export async function getFixtures(opts: {
  status?: FixtureStatus[];
  sportGroupKey?: string;
  limit?: number;
  orderBy?: "commence_time";
}): Promise<FixtureWithOdds[]> {
  const supabase = await createClient();
  let query = supabase.from("fixtures").select(FIXTURE_SELECT);

  if (opts.status?.length) query = query.in("status", opts.status);
  query = query.order(opts.orderBy ?? "commence_time", { ascending: true });
  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let rows = (data ?? []) as unknown as FixtureWithOdds[];
  if (opts.sportGroupKey) {
    rows = rows.filter((f) => f.competition?.sport_group?.key === opts.sportGroupKey);
  }
  return rows;
}
