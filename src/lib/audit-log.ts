import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/types/database";

/** Fire-and-forget: log a privileged action after it already succeeded.
 * Never blocks or fails the user-facing action if this errors -- audit
 * logging is oversight, not a security control, so it doesn't need the
 * same atomicity guarantees as the action itself. */
export function logAudit(
  action: string,
  entityType: string,
  entityId?: string,
  oldValues?: Json,
  newValues?: Json
) {
  const supabase = createClient();
  supabase
    .rpc("fn_write_audit_log", {
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_old_values: oldValues ?? undefined,
      p_new_values: newValues ?? undefined,
    })
    .then(
      () => {},
      () => {}
    );
}
