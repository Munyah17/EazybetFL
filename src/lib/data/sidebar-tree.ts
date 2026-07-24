import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { displayGroupName } from "@/lib/sport-display";
import { competitionCountry } from "@/lib/competition-country";

export type CompetitionNode = {
  id: string;
  key: string;
  title: string;
  country: string;
  fixtureCount: number;
};

export type CountryNode = {
  country: string;
  fixtureCount: number;
  competitions: CompetitionNode[];
};

export type SportGroupNode = {
  id: string;
  key: string;
  name: string;
  icon: string | null;
  fixtureCount: number;
  countries: CountryNode[];
};

function sortCountries(a: string, b: string) {
  if (a === "International") return -1;
  if (b === "International") return 1;
  return a.localeCompare(b);
}

/** Full sport -> country -> competition tree for the sidebar, built only
 * from competitions/fixtures we actually have data for (same
 * "don't advertise what we can't serve" rule as getActiveSportGroups).
 *
 * The (app) layout renders this on every single navigation (it reads
 * cookies for the auth check, which forces the whole route dynamic), so
 * without caching this multi-table join re-runs on every click. It's
 * not user-specific, so a short cache window is safe and makes
 * navigation feel instant instead of re-querying Supabase each time. */
export const getSidebarTree = unstable_cache(
  async (): Promise<SportGroupNode[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase.from("sport_groups").select(
      `id, key, name, icon,
       competitions!inner (
         id, odds_api_key, title,
         fixtures!inner ( id )
       )`
    );

    if (error) throw new Error(error.message);

    const groups: SportGroupNode[] = (data ?? []).map((row) => {
      const countryMap = new Map<string, CompetitionNode[]>();

      for (const comp of row.competitions ?? []) {
        const fixtureCount = comp.fixtures?.length ?? 0;
        if (fixtureCount === 0) continue;
        const country = competitionCountry(comp.odds_api_key);
        const node: CompetitionNode = {
          id: comp.id,
          key: comp.odds_api_key,
          title: comp.title,
          country,
          fixtureCount,
        };
        if (!countryMap.has(country)) countryMap.set(country, []);
        countryMap.get(country)!.push(node);
      }

      const countries: CountryNode[] = Array.from(countryMap.entries())
        .map(([country, competitions]) => ({
          country,
          fixtureCount: competitions.reduce((sum, c) => sum + c.fixtureCount, 0),
          competitions: competitions.sort((a, b) => a.title.localeCompare(b.title)),
        }))
        .sort((a, b) => sortCountries(a.country, b.country));

      return {
        id: row.id,
        key: row.key,
        name: row.name,
        icon: row.icon,
        fixtureCount: countries.reduce((sum, c) => sum + c.fixtureCount, 0),
        countries,
      };
    });

    return groups
      .filter((g) => g.countries.length > 0)
      .sort((a, b) => {
        if (a.key === "soccer") return -1;
        if (b.key === "soccer") return 1;
        return displayGroupName(a.name).localeCompare(displayGroupName(b.name));
      });
  },
  ["sidebar-tree"],
  { revalidate: 30, tags: ["sidebar-tree"] }
);
