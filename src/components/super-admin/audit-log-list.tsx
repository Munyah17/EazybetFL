"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Json } from "@/types/database";

type AuditLog = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Json | null;
  new_values: Json | null;
  created_at: string;
  profiles: { full_name: string } | null;
};

export function AuditLogList({ logs }: { logs: AuditLog[] }) {
  const [actionFilter, setActionFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const actions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))).sort(), [logs]);
  const filtered = actionFilter === "all" ? logs : logs.filter((l) => l.action === actionFilter);

  return (
    <div className="flex flex-col gap-3">
      <Select value={actionFilter} onValueChange={setActionFilter}>
        <SelectTrigger className="w-full sm:w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Actions</SelectItem>
          {actions.map((a) => (
            <SelectItem key={a} value={a}>
              {a.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No matching log entries.</p>
        ) : (
          filtered.map((log) => {
            const expanded = expandedId === log.id;
            const hasValues = log.old_values !== null || log.new_values !== null;
            return (
              <div key={log.id} className="border-b border-border/60 last:border-0">
                <button
                  onClick={() => hasValues && setExpandedId(expanded ? null : log.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {log.action.replace(/_/g, " ")}
                      </Badge>
                      <span className="truncate text-xs text-muted-foreground">{log.entity_type}</span>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium">{log.profiles?.full_name ?? "Unknown actor"}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {new Date(log.created_at).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {hasValues && (
                    <ChevronDown
                      className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
                    />
                  )}
                </button>

                {expanded && hasValues && (
                  <div className="grid grid-cols-1 gap-2 px-4 pb-3 sm:grid-cols-2">
                    {log.old_values !== null && (
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-muted-foreground">Before</p>
                        <pre className="overflow-x-auto rounded-lg bg-muted p-2 text-[11px]">
                          {JSON.stringify(log.old_values, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.new_values !== null && (
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-muted-foreground">After</p>
                        <pre className="overflow-x-auto rounded-lg bg-muted p-2 text-[11px]">
                          {JSON.stringify(log.new_values, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
