import { createClient } from "@/lib/supabase/server";
import { SessionProvider } from "@/lib/auth/session-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { DesktopSidebar } from "@/components/layout/desktop-sidebar";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { Footer } from "@/components/layout/footer";
import { BetslipSheet } from "@/components/betting/betslip-sheet";
import { BetslipPanel } from "@/components/betting/betslip-panel";
import { getSidebarTree } from "@/lib/data/sidebar-tree";
import { getActiveAnnouncement } from "@/lib/data/banners";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  let wallet = null;
  let openBetsCount = 0;

  const [sidebarTree, announcement, sessionData] = await Promise.all([
    getSidebarTree(),
    getActiveAnnouncement(),
    user
      ? Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).single(),
          supabase.from("wallets").select("*").eq("user_id", user.id).single(),
          supabase.from("bets").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "open"),
        ])
      : Promise.resolve(null),
  ]);

  if (sessionData) {
    profile = sessionData[0].data;
    wallet = sessionData[1].data;
    openBetsCount = sessionData[2].count ?? 0;
  }

  return (
    <SessionProvider initialProfile={profile} initialWallet={wallet} initialOpenBetsCount={openBetsCount}>
      <AnnouncementBar announcement={announcement} />
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-[1440px]">
        <DesktopSidebar groups={sidebarTree} />
        <main className="min-w-0 flex-1 pb-20 lg:pb-6">{children}</main>
        <BetslipPanel />
      </div>
      <Footer />
      <BottomNav />
      <BetslipSheet />
    </SessionProvider>
  );
}
