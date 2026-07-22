import Link from "next/link";
import { getFixtures } from "@/lib/data/fixtures";
import { getActiveSportGroups } from "@/lib/data/sport-groups";
import { getActiveHeroSlides } from "@/lib/data/banners";
import { SportsBar } from "@/components/betting/sports-bar";
import { HeroCarousel } from "@/components/betting/hero-carousel";
import { LeagueSections } from "@/components/betting/league-section";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const revalidate = 30;

export default async function HomePage() {
  const [groups, slides, liveFixtures, upcomingFixtures] = await Promise.all([
    getActiveSportGroups(),
    getActiveHeroSlides(),
    getFixtures({ status: ["live"], limit: 20 }),
    getFixtures({ status: ["upcoming"], limit: 30 }),
  ]);

  return (
    <div className="flex flex-col">
      <HeroCarousel slides={slides} />

      <div className="lg:hidden">
        <SportsBar groups={groups} />
      </div>

      <div className="flex items-center justify-between px-4 pb-2 pt-3 lg:hidden">
        <h2 className="text-sm font-bold">Top Sports</h2>
        <Link href="/sports" className="text-xs font-medium text-primary">
          See All
        </Link>
      </div>

      <div className="px-3 pt-3 lg:px-5">
        <Tabs defaultValue={liveFixtures.length ? "live" : "upcoming"}>
          <TabsList className="w-full lg:w-auto">
            <TabsTrigger value="live" className="flex-1 lg:flex-none lg:px-6">
              Top Live {liveFixtures.length > 0 && `(${liveFixtures.length})`}
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="flex-1 lg:flex-none lg:px-6">
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
