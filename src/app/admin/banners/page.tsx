import { createClient } from "@/lib/supabase/server";
import { BannerManager } from "@/components/admin/banner-manager";

export default async function AdminBannersPage() {
  const supabase = await createClient();
  const { data: banners } = await supabase
    .from("banners")
    .select("*")
    .order("kind")
    .order("display_order");

  const heroSlides = (banners ?? []).filter((b) => b.kind === "hero_slide");
  const announcements = (banners ?? []).filter((b) => b.kind === "announcement");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold">Banners</h1>
        <p className="text-sm text-muted-foreground">
          Manage the home page hero carousel and the site-wide announcement strip.
        </p>
      </div>

      <BannerManager
        kind="hero_slide"
        title="Hero Carousel Slides"
        description="Shown on the home page between the sports panel and the betslip."
        initialBanners={heroSlides}
      />

      <BannerManager
        kind="announcement"
        title="Announcement Bar"
        description="A dismissible strip shown at the top of every page. Only the highest-priority active one is shown."
        initialBanners={announcements}
      />
    </div>
  );
}
