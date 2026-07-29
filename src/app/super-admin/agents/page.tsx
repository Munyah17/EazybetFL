import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AgentsTable } from "@/components/admin/agents-table";

export default async function ManageAgentsPage() {
  const supabase = await createClient();
  const { data: agents } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, commission_rate")
    .eq("role", "agent")
    .order("full_name");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Link href="/super-admin" className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-bold">Manage Agents</h1>
      </div>
      <AgentsTable initialAgents={agents ?? []} />
    </div>
  );
}
