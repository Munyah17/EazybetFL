import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { PaginatedLeagueSections } from "@/components/betting/paginated-league-sections";
import { getFixtures } from "@/lib/data/fixtures";
import { getActiveSportGroups } from "@/lib/data/sport-groups";
import { competitionCountry } from "@/lib/competition-country";

export const revalidate = 30;

export default async function CompetitionPage({
  params,
}: {
  params: Promise<{ key: string; competitionKey: string }>;
}) {
  const { key, competitionKey } = await params;
  const groups = await getActiveSportGroups();
  const group = groups.find((g) => g.key === key);
  if (!group) notFound();

  const fixtures = await getFixtures({
    status: ["upcoming", "live"],
    competitionKey,
    limit: 100,
  });
  if (fixtures.length === 0) notFound();

  const title = fixtures[0].competition?.title ?? "Competition";
  const country = competitionCountry(competitionKey);

  return (
    <div className="flex flex-col">
      <PageHeader title={title} backHref={`/sports/${key}`} />
      <div className="px-3 pt-3 pb-3 lg:px-5">
        <p className="mb-3 text-xs font-medium text-muted-foreground">{country}</p>
        <PaginatedLeagueSections fixtures={fixtures} />
      </div>
    </div>
  );
}
