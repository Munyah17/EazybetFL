import { createClient } from "@/lib/supabase/server";
import { displayGroupName } from "@/lib/sport-display";

export type SportGroup = { id: string; key: string; name: string; icon: string | null };
export type SportGroupWithCount = SportGroup & { fixtureCount: number };

/** Football always leads (it's the dominant sport for our audience),
 * everything else follows alphabetically by display name. */
function sortGroups<T extends { key: string; name: string }>(groups: T[]): T[] {
  return [...groups].sort((a, b) => {
    if (a.key === "soccer") return -1;
    if (b.key === "soccer") return 1;
    return displayGroupName(a.name).localeCompare(displayGroupName(b.name));
  });
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
    .select("id, key, name, icon, competitions!inner( fixtures!inner( id ) )");

  if (error) throw new Error(error.message);

  const groups = (data ?? []).map((row) => {
    const fixtureCount = (row.competitions ?? []).reduce(
      (sum, c) => sum + (c.fixtures?.length ?? 0),
      0
    );
    return { id: row.id, key: row.key, name: row.name, icon: row.icon, fixtureCount };
  });

  return sortGroups(groups);
}
