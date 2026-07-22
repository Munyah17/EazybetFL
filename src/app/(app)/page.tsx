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

      <Tabs defaultValue={liveFixtures.length ? "live" : "upcoming"} className="gap-0">
        <div className="border-b border-border px-3 py-2.5 lg:px-5">
          <TabsList className="w-full lg:w-auto">
            <TabsTrigger value="live" className="flex-1 lg:flex-none lg:px-6">
              Live {liveFixtures.length > 0 && `(${liveFixtures.length})`}
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="flex-1 lg:flex-none lg:px-6">
              Upcoming
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="lg:hidden">
          <SportsBar groups={groups} />
        </div>

        <div className="px-3 pt-3 lg:px-5">
          <TabsContent value="live">
            <LeagueSections fixtures={liveFixtures} />
          </TabsContent>
          <TabsContent value="upcoming">
            <LeagueSections fixtures={upcomingFixtures} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
