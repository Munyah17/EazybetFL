import { createClient } from "@/lib/supabase/server";

export type SportGroup = { id: string; key: string; name: string; icon: string | null };
export type SportGroupWithCount = SportGroup & { fixtureCount: number };

/** display_order reflects global/African viewership and betting volume
 * (see groupPriority in odds-api/client.ts) -- football leads, then the
 * rest in roughly that order, not alphabetically. */
function sortGroups<T extends { display_order: number; name: string }>(groups: T[]): T[] {
  return [...groups].sort((a, b) => a.display_order - b.display_order);
}

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
    .select("id, key, name, icon, display_order, competitions!inner( fixtures!inner( id ) )");

  if (error) throw new Error(error.message);

  const groups = (data ?? []).map((row) => {
    const fixtureCount = (row.competitions ?? []).reduce(
      (sum, c) => sum + (c.fixtures?.length ?? 0),
      0
    );
    return { id: row.id, key: row.key, name: row.name, icon: row.icon, display_order: row.display_order, fixtureCount };
  });

  return sortGroups(groups);
}
