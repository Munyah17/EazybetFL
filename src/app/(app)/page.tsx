import { getFixtures } from "@/lib/data/fixtures";
import { getActiveSportGroups } from "@/lib/data/sport-groups";
import { getActiveHeroSlides } from "@/lib/data/banners";
import { HeroCarousel } from "@/components/betting/hero-carousel";
import { MatchExplorer } from "@/components/betting/match-explorer";

export const revalidate = 30;

export default async function HomePage() {
  const [groups, slides, liveFixtures, upcomingFixtures] = await Promise.all([
    getActiveSportGroups(),
    getActiveHeroSlides(),
    getFixtures({ status: ["live"], limit: 40 }),
    // Wider pool than the Upcoming tab needs so Top Events is a real
    // popularity ranking, not just the chronological head of the list.
    getFixtures({ status: ["upcoming"], limit: 150 }),
  ]);

  return (
    <div className="flex flex-col">
      <HeroCarousel slides={slides} />
      <MatchExplorer groups={groups} liveFixtures={liveFixtures} upcomingFixtures={upcomingFixtures} />
    </div>
  );
}
