import { createClient } from "@/lib/supabase/server";
import { LogsList } from "@/components/super-admin/logs-list";

export default async function SystemLogsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("system_logs")
    .select("id, level, source, message, context, resolved_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold">Logs</h1>
        <p className="text-sm text-muted-foreground">
          Every server-side failure the app hits: cron runs, webhooks, payment verification,
          settlement -- anything that used to only show up in a Vercel log stream nobody was
          watching now lands here permanently. Most recent 100, newest first.
        </p>
      </div>
      <LogsList logs={data ?? []} />
    </div>
  );
}
