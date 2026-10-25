import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { PaginatedLeagueSections } from "@/components/betting/paginated-league-sections";
import { LiveRefresher } from "@/components/betting/live-refresher";
import { getFixtures } from "@/lib/data/fixtures";
import { createClient } from "@/lib/supabase/server";
import { competitionCountry } from "@/lib/competition-country";

export const revalidate = 30;

export default async function CompetitionPage({
  params,
}: {
  params: Promise<{ key: string; competitionKey: string }>;
}) {
  const { key, competitionKey } = await params;

  // Resolve the competition directly rather than inferring it from the
  // fixtures query -- a league with no upcoming fixtures right now (between
  // rounds, or odds sync stalled) used to hit notFound() and looked like a
  // broken link. The sidebar only advertises competitions we carry, so this
  // lookup both validates the URL and gives us the title for the header.
  const supabase = await createClient();
  const { data: competition } = await supabase
    .from("competitions")
    .select("id, title, odds_api_key, sport_groups!inner ( key )")
    .eq("odds_api_key", competitionKey)
    .eq("sport_groups.key", key)
    .maybeSingle();
  if (!competition) notFound();

  const fixtures = await getFixtures({
    status: ["upcoming", "live"],
    competitionKey,
    limit: 100,
  });

  const country = competitionCountry(competitionKey);
  const hasLive = fixtures.some((f) => f.status === "live");

  return (
    <div className="flex flex-col">
      {hasLive && <LiveRefresher />}
      <PageHeader title={competition.title} backHref={`/sports/${key}`} />
      <div className="px-3 pt-3 pb-3 lg:px-5">
        <p className="mb-3 text-xs font-medium text-muted-foreground">{country}</p>
        {fixtures.length > 0 ? (
          <PaginatedLeagueSections fixtures={fixtures} />
        ) : (
          <div className="flex flex-col items-center gap-1 py-16 text-center">
            <p className="text-sm font-medium">No upcoming fixtures</p>
            <p className="text-xs text-muted-foreground">
              There are no matches on the board for {competition.title} right now -- check back
              soon.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
