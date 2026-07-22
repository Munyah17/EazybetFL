import { PageHeader } from "@/components/layout/page-header";
import { LeagueSections } from "@/components/betting/league-section";
import { getFixtures } from "@/lib/data/fixtures";

export const revalidate = 15;

export default async function LivePage() {
  const fixtures = await getFixtures({ status: ["live"], limit: 100 });

  return (
    <div className="flex flex-col">
      <PageHeader title="Live" backHref="/" />
      <div className="px-3 pt-3 pb-3">
        <LeagueSections fixtures={fixtures} />
      </div>
    </div>
  );
}
