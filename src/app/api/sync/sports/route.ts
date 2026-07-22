import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { oddsApi, iconForGroup, slugify } from "@/lib/odds-api/client";
import { requireCronSecret } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  const supabase = createAdminClient();
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
    display_order: i,
    active: true,
  }));

  const { error: groupsUpsertErr } = await supabase
    .from("sport_groups")
    .upsert(groupRowsToUpsert, { onConflict: "key" });
  if (groupsUpsertErr) {
    return NextResponse.json({ error: `sport_groups upsert: ${groupsUpsertErr.message}` }, { status: 500 });
  }

  const { data: groupRows, error: groupsErr } = await supabase.from("sport_groups").select("id, key");
  if (groupsErr) return NextResponse.json({ error: groupsErr.message }, { status: 500 });
  const groupIdByKey = new Map(groupRows!.map((g) => [g.key, g.id]));

  const competitionRows = sports
    .filter((s) => !s.has_outrights && groupIdByKey.has(slugify(s.group)))
    .map((s, i) => ({
      sport_group_id: groupIdByKey.get(slugify(s.group))!,
      odds_api_key: s.key,
      title: s.title,
      active: s.active,
      display_order: i,
    }));

  const { error: compUpsertErr } = await supabase
    .from("competitions")
    .upsert(competitionRows, { onConflict: "odds_api_key" });
  if (compUpsertErr) {
    return NextResponse.json({ error: `competitions upsert: ${compUpsertErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ groups: groups.size, competitions: competitionRows.length });
}
