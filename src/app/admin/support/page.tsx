import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminSupportPage() {
  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id, subject, status, updated_at, profiles!user_id ( full_name )")
    .order("status", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit(200);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-lg font-bold">Support Tickets</h1>
      <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
        {(tickets ?? []).map((t) => (
          <Link
            key={t.id}
            href={`/admin/support/${t.id}`}
            className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5 last:border-0 hover:bg-accent"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{t.subject}</p>
              <p className="text-xs text-muted-foreground">
                {t.profiles?.full_name ?? "Unknown user"} &middot;{" "}
                {new Date(t.updated_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <Badge variant={t.status === "open" ? "secondary" : "outline"} className="shrink-0 text-[10px] capitalize">
              {t.status}
            </Badge>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
        {!tickets?.length && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">No support tickets.</p>
        )}
      </Card>
    </div>
  );
}
