import { createClient } from "@/lib/supabase/server";

export type SportGroup = { id: string; key: string; name: string; icon: string | null };

/**
 * Only returns sport groups that actually have at least one fixture right
 * now. We deliberately don't show every group The Odds API knows about --
 * only what we've actually fetched -- so the sports bar never leads to a
 * dead-end empty page for a league/sport we don't carry data for.
 */
export async function getActiveSportGroups(): Promise<SportGroup[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sport_groups")
    .select("id, key, name, icon, display_order, competitions!inner(fixtures!inner(id))")
    .order("display_order");

  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const groups: SportGroup[] = [];
  for (const row of data ?? []) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    groups.push({ id: row.id, key: row.key, name: row.name, icon: row.icon });
  }
  return groups;
}
