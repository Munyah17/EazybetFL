import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { Database } from "@/types/database";

export type Banner = Database["public"]["Tables"]["banners"]["Row"];

// Public, non-user-specific data -- cached briefly so it isn't re-queried
// on every navigation (the (app) layout renders getActiveAnnouncement on
// every single page). See getSidebarTree for the full rationale.

export const getActiveHeroSlides = unstable_cache(
  async (): Promise<Banner[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("banners")
      .select("*")
      .eq("kind", "hero_slide")
      .eq("active", true)
      .order("display_order", { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["active-hero-slides"],
  { revalidate: 30, tags: ["banners"] }
);

export const getActiveAnnouncement = unstable_cache(
  async (): Promise<Banner | null> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("banners")
      .select("*")
      .eq("kind", "announcement")
      .eq("active", true)
      .order("display_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  },
  ["active-announcement"],
  { revalidate: 30, tags: ["banners"] }
);
