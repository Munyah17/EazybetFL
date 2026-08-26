"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type LogRow = {
  id: string;
  level: string;
  source: string;
  message: string;
  context: unknown;
  resolved_at: string | null;
  created_at: string;
};

export function LogsList({ logs: initialLogs }: { logs: LogRow[] }) {
  const [logs, setLogs] = useState(initialLogs);
  const [resolving, setResolving] = useState<string | null>(null);

  async function resolve(id: string) {
    setResolving(id);
    const supabase = createClient();
    const { error } = await supabase.from("system_logs").update({ resolved_at: new Date().toISOString() }).eq("id", id);
    setResolving(null);
    if (error) {
      toast.error("Couldn't mark resolved", { description: error.message });
      return;
    }
    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, resolved_at: new Date().toISOString() } : l)));
  }

  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground">No errors or warnings logged. Clean.</p>;
  }

  return (
    <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
      {logs.map((log) => (
        <div
          key={log.id}
          className={`flex items-start gap-3 border-b border-border/60 px-4 py-3.5 last:border-0 ${
            log.resolved_at ? "opacity-50" : ""
          }`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={log.level === "error" ? "destructive" : "secondary"} className="shrink-0">
                {log.level}
              </Badge>
              <span className="truncate text-xs font-semibold text-muted-foreground">{log.source}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {new Date(log.created_at).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="mt-1 text-sm">{log.message}</p>
            {!!log.context && (
              <pre className="mt-1 max-w-full overflow-x-auto rounded bg-muted p-2 text-[11px] text-muted-foreground">
                {JSON.stringify(log.context, null, 2)}
              </pre>
            )}
          </div>
          {!log.resolved_at && (
            <Button
              size="sm"
              variant="outline"
              disabled={resolving === log.id}
              onClick={() => resolve(log.id)}
              className="shrink-0"
            >
              <Check className="size-3.5" />
              Resolve
            </Button>
          )}
        </div>
      ))}
    </Card>
  );
}
