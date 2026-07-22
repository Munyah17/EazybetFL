import { PageHeader } from "@/components/layout/page-header";
import { SportsBar } from "@/components/betting/sports-bar";
import { PaginatedLeagueSections } from "@/components/betting/paginated-league-sections";
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
        <PaginatedLeagueSections fixtures={fixtures} />
      </div>
    </div>
  );
}
