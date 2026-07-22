import { PageHeader } from "@/components/layout/page-header";
import { SportsBar } from "@/components/betting/sports-bar";
import { LeagueSections } from "@/components/betting/league-section";
import { getFixtures } from "@/lib/data/fixtures";
import { getActiveSportGroups } from "@/lib/data/sport-groups";

export const revalidate = 30;

export default async function SportsPage() {
  const [groups, fixtures] = await Promise.all([
    getActiveSportGroups(),
    getFixtures({ status: ["upcoming", "live"], limit: 100 }),
  ]);

  return (
    <div className="flex flex-col">
      <PageHeader title="All Sports" backHref="/" />
      <div className="lg:hidden">
        <SportsBar groups={groups} />
      </div>
      <div className="px-3 pb-3 lg:px-5 lg:pt-3">
        <LeagueSections fixtures={fixtures} />
      </div>
    </div>
  );
}
