import { createClient } from "@/lib/supabase/server";
import { AuditLogList } from "@/components/super-admin/audit-log-list";

export default async function AuditLogPage() {
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, old_values, new_values, created_at, profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-bold">Audit Log</h1>
      <p className="text-sm text-muted-foreground">
        Last 100 privileged actions (role changes, commission rates, withdrawal decisions,
        account suspensions, bet settlements).
      </p>
      <AuditLogList logs={logs ?? []} />
    </div>
  );
}
