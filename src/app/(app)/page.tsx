import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getFixtures } from "@/lib/data/fixtures";
import { getActiveSportGroups } from "@/lib/data/sport-groups";
import { SportsBar } from "@/components/betting/sports-bar";
import { PromoBanner } from "@/components/betting/promo-banner";
import { LeagueSections } from "@/components/betting/league-section";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const revalidate = 30;

export default async function HomePage() {
  const supabase = await createClient();

  const [groups, { data: promo }, liveFixtures, upcomingFixtures] = await Promise.all([
    getActiveSportGroups(),
    supabase
      .from("promotions")
      .select("title, description")
      .eq("type", "welcome_bonus")
      .eq("active", true)
      .limit(1)
      .maybeSingle(),
    getFixtures({ status: ["live"], limit: 20 }),
    getFixtures({ status: ["upcoming"], limit: 30 }),
  ]);

  return (
    <div className="flex flex-col">
      {promo && <PromoBanner title={promo.title} description={promo.description} />}

      <SportsBar groups={groups} />

      <div className="flex items-center justify-between px-4 pb-2 pt-1">
        <h2 className="text-sm font-bold">Top Sports</h2>
        <Link href="/sports" className="text-xs font-medium text-primary">
          See All
        </Link>
      </div>

      <div className="px-3">
        <Tabs defaultValue={liveFixtures.length ? "live" : "upcoming"}>
          <TabsList className="w-full">
            <TabsTrigger value="live" className="flex-1">
              Top Live {liveFixtures.length > 0 && `(${liveFixtures.length})`}
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="flex-1">
              Upcoming
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="pt-3">
            <LeagueSections fixtures={liveFixtures} />
          </TabsContent>
          <TabsContent value="upcoming" className="pt-3">
            <LeagueSections fixtures={upcomingFixtures} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
