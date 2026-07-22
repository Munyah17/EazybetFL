import Link from "next/link";
import { ChevronRight, Bookmark } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/require-user";
import { formatOdds } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  active: "bg-primary/15 text-primary",
  loaded: "bg-boost/15 text-boost",
  expired: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/15 text-destructive",
};

function timeUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

export default async function BookedBetsPage() {
  const { supabase, user } = await requireUser();
  const { data: bookings } = await supabase
    .from("booked_bets")
    .select("id, bet_code, bet_type, selections, total_odds, status, expires_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="flex flex-col">
      <PageHeader title="Booked Bets" backHref="/" />

      <div className="flex flex-col gap-3 p-4">
        <Card className="items-center gap-1 border-border/60 bg-card p-4 text-center text-sm text-muted-foreground">
          <Bookmark className="mb-1 size-5 text-primary" />
          Book a bet to save your selections and load them later.
        </Card>

        {!bookings?.length ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No booked bets yet.</p>
        ) : (
          bookings.map((b) => {
            const selectionsCount = Array.isArray(b.selections) ? b.selections.length : 0;
            return (
              <Link key={b.id} href={`/load-bet?code=${b.bet_code}`}>
                <Card className="flex-row items-center justify-between gap-3 border-border/60 bg-card p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold tracking-wider">{b.bet_code}</span>
                      <Badge className={cn("border-0 text-[10px] font-bold", STATUS_STYLE[b.status])}>
                        {b.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectionsCount} Selection{selectionsCount !== 1 ? "s" : ""} · Odds {formatOdds(b.total_odds)}
                    </p>
                    {b.status === "active" && (
                      <p className="text-xs text-muted-foreground">Expires in {timeUntil(b.expires_at)}</p>
                    )}
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
