import { createClient } from "@/lib/supabase/server";
import { SessionProvider } from "@/lib/auth/session-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { DesktopSidebar } from "@/components/layout/desktop-sidebar";
import { BetslipSheet } from "@/components/betting/betslip-sheet";
import { BetslipPanel } from "@/components/betting/betslip-panel";
import { getActiveSportGroupsWithCounts } from "@/lib/data/sport-groups";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  let wallet = null;

  const [sportGroups, sessionData] = await Promise.all([
    getActiveSportGroupsWithCounts(),
    user
      ? Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).single(),
          supabase.from("wallets").select("*").eq("user_id", user.id).single(),
        ])
      : Promise.resolve(null),
  ]);

  if (sessionData) {
    profile = sessionData[0].data;
    wallet = sessionData[1].data;
  }

  return (
    <SessionProvider initialProfile={profile} initialWallet={wallet}>
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-[1440px]">
        <DesktopSidebar groups={sportGroups} />
        <main className="min-w-0 flex-1 pb-20 lg:pb-6">{children}</main>
        <BetslipPanel />
      </div>
      <BottomNav />
      <BetslipSheet />
    </SessionProvider>
  );
}
