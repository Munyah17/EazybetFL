import type { SupabaseClient } from "@supabase/supabase-js";
import { oddsApi, iconForGroup, slugify, groupPriority, competitionPriority } from "@/lib/odds-api/client";
import type { Database } from "@/types/database";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

export async function syncSports(
  supabase: SupabaseClient<Database>
): Promise<Result<{ groups: number; competitions: number }>> {
  const sports = await oddsApi.listSports();

  const groups = new Map<string, { key: string; name: string; icon: string }>();
  for (const s of sports) {
    if (!groups.has(s.group)) {
      groups.set(s.group, { key: slugify(s.group), name: s.group, icon: iconForGroup(s.group) });
    }
  }

  const groupRowsToUpsert = Array.from(groups.values()).map((g, i) => ({
    key: g.key,
    name: g.name,
    icon: g.icon,
    display_order: groupPriority(g.name) * 1000 + i,
    active: true,
  }));

  const { error: groupsUpsertErr } = await supabase
    .from("sport_groups")
    .upsert(groupRowsToUpsert, { onConflict: "key" });
  if (groupsUpsertErr) {
    return { ok: false, error: `sport_groups upsert: ${groupsUpsertErr.message}`, status: 500 };
  }

  const { data: groupRows, error: groupsErr } = await supabase.from("sport_groups").select("id, key");
  if (groupsErr) return { ok: false, error: groupsErr.message, status: 500 };
  const groupIdByKey = new Map(groupRows!.map((g) => [g.key, g.id]));

  const competitionRows = sports
    .filter((s) => !s.has_outrights && groupIdByKey.has(slugify(s.group)))
    .map((s, i) => ({
      sport_group_id: groupIdByKey.get(slugify(s.group))!,
      odds_api_key: s.key,
      title: s.title,
      active: s.active,
      display_order: competitionPriority(s.title) * 1000 + i,
    }));

  const { error: compUpsertErr } = await supabase
    .from("competitions")
    .upsert(competitionRows, { onConflict: "odds_api_key" });
  if (compUpsertErr) {
    return { ok: false, error: `competitions upsert: ${compUpsertErr.message}`, status: 500 };
  }

  return { ok: true, data: { groups: groups.size, competitions: competitionRows.length } };
}
