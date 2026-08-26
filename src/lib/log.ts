import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/**
 * The one place every server-side failure should pass through. console.error
 * alone isn't enough -- Vercel's log stream is ephemeral and nobody's
 * watching it in real time, so a failure there is functionally silent.
 * Persisting to `system_logs` (readable on the super admin System Status
 * page) means a cron/webhook/sync failure is still visible days later, not
 * just for the few minutes it sat in a log stream. Logging itself must never
 * throw -- a failure here should never take down the caller's actual error
 * handling, so the insert is wrapped in its own try/catch.
 */
async function write(level: "error" | "warn", source: string, message: string, context?: Record<string, unknown>) {
  console[level === "error" ? "error" : "warn"](`[${source}]`, message, context ?? "");
  try {
    const admin = createAdminClient();
    await admin.from("system_logs").insert({ level, source, message, context: (context as Json) ?? null });
  } catch (e) {
    console.error("[log] failed to persist system log:", (e as Error).message);
  }
}

/** `source` should identify where this came from at a glance in the log
 * list, e.g. "cron:sync-settlement", "webhook:paynow", "api:deposits/ecocash". */
export async function logError(source: string, error: unknown, context?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  await write("error", source, message, stack ? { ...context, stack } : context);
}

export async function logWarn(source: string, message: string, context?: Record<string, unknown>) {
  await write("warn", source, message, context);
}
