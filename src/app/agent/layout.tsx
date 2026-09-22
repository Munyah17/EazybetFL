import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AgentShell } from "@/components/agent/agent-shell";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/agent");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || profile.role !== "agent") {
    redirect("/");
  }

  return <AgentShell>{children}</AgentShell>;
}
