import { createClient } from "@/lib/supabase/server";

export type SportGroup = { id: string; key: string; name: string; icon: string | null };
export type SportGroupWithCount = SportGroup & { fixtureCount: number };

/**
 * Only returns sport groups that actually have at least one fixture right
 * now. We deliberately don't show every group The Odds API knows about --
 * only what we've actually fetched -- so the sports bar never leads to a
 * dead-end empty page for a league/sport we don't carry data for.
 */
export async function getActiveSportGroups(): Promise<SportGroup[]> {
  const groups = await getActiveSportGroupsWithCounts();
  return groups.map(({ id, key, name, icon }) => ({ id, key, name, icon }));
}

export async function getActiveSportGroupsWithCounts(): Promise<SportGroupWithCount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sport_groups")
    .select(
      "id, key, name, icon, display_order, competitions!inner( fixtures!inner( id ) )"
    )
    .order("display_order");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const fixtureCount = (row.competitions ?? []).reduce(
      (sum, c) => sum + (c.fixtures?.length ?? 0),
      0
    );
    return { id: row.id, key: row.key, name: row.name, icon: row.icon, fixtureCount };
  });
}
