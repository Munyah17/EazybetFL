import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type Banner = Database["public"]["Tables"]["banners"]["Row"];

export async function getActiveHeroSlides(): Promise<Banner[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("banners")
    .select("*")
    .eq("kind", "hero_slide")
    .eq("active", true)
    .order("display_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getActiveAnnouncement(): Promise<Banner | null> {
  const supabase = await createClient();
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
}
