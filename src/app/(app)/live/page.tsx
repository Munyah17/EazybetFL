import { PageHeader } from "@/components/layout/page-header";
import { PaginatedLeagueSections } from "@/components/betting/paginated-league-sections";
import { getFixtures } from "@/lib/data/fixtures";

export const revalidate = 15;

export default async function LivePage() {
  const fixtures = await getFixtures({ status: ["live"], limit: 100 });

  return (
    <div className="flex flex-col">
      <PageHeader title="Live" backHref="/" />
      <div className="px-3 pt-3 pb-3">
        <PaginatedLeagueSections fixtures={fixtures} />
      </div>
    </div>
  );
}
