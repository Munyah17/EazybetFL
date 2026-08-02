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
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-bold">Manage Agents</h1>
      <AgentsTable initialAgents={agents ?? []} />
    </div>
  );
}
