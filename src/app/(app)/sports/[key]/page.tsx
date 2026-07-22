import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { LeagueSections } from "@/components/betting/league-section";
import { getFixtures } from "@/lib/data/fixtures";
import { getActiveSportGroups } from "@/lib/data/sport-groups";

export const revalidate = 30;

export default async function SportGroupPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const groups = await getActiveSportGroups();
  const group = groups.find((g) => g.key === key);
  if (!group) notFound();

  const fixtures = await getFixtures({ status: ["upcoming", "live"], sportGroupKey: key, limit: 100 });

  return (
    <div className="flex flex-col">
      <PageHeader title={group.name} backHref="/sports" />
      <div className="px-3 pt-3 pb-3">
        <LeagueSections fixtures={fixtures} />
      </div>
    </div>
  );
}
