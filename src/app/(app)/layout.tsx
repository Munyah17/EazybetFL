import { createClient } from "@/lib/supabase/server";
import { SessionProvider } from "@/lib/auth/session-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { BetslipSheet } from "@/components/betting/betslip-sheet";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  let wallet = null;

  if (user) {
    const [{ data: p }, { data: w }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("wallets").select("*").eq("user_id", user.id).single(),
    ]);
    profile = p;
    wallet = w;
  }

  return (
    <SessionProvider initialProfile={profile} initialWallet={wallet}>
      <SiteHeader />
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
      <BetslipSheet />
    </SessionProvider>
  );
}
