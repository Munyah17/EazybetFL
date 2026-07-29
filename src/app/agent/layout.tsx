import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AgentNav } from "@/components/agent/agent-nav";
import { Logo } from "@/components/layout/logo";
import { Badge } from "@/components/ui/badge";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/agent");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || profile.role !== "agent") {
    redirect("/");
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/agent">
            <Logo />
          </Link>
          <Badge variant="secondary" className="text-[10px]">
            Agent Dashboard
          </Badge>
        </div>
        <Link href="/" className="text-sm font-medium text-primary">
          Back to Site
        </Link>
      </header>
      <AgentNav />
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
