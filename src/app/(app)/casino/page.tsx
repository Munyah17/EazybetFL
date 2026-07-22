import { Dices, Play } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

export default async function CasinoPage() {
  const supabase = await createClient();
  const { data: games } = await supabase
    .from("casino_games")
    .select("*")
    .eq("active", true)
    .order("display_order");

  return (
    <div className="flex flex-col">
      <PageHeader title="Spineazy Casino" backHref="/" />

      <div className="flex flex-col gap-4 p-4">
        <Card className="items-center gap-1 border-border/60 bg-gradient-to-br from-primary/20 via-card to-card p-6 text-center">
          <Dices className="mb-1 size-8 text-primary" />
          <h2 className="text-lg font-bold">Spineazy</h2>
          <p className="text-sm text-muted-foreground">
            Slots, live casino and instant-win games. Same wallet, same balance.
          </p>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          {(games ?? []).map((g) => (
            <Card key={g.id} className="gap-2 overflow-hidden border-border/60 bg-card p-0">
              <div className="flex aspect-square items-center justify-center bg-secondary">
                <Dices className="size-8 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-1 p-3">
                <p className="truncate text-sm font-semibold">{g.title}</p>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-[10px]">
                    {g.category}
                  </Badge>
                  {g.rtp && <span className="text-[10px] text-muted-foreground">RTP {g.rtp}%</span>}
                </div>
                <button className="mt-1 flex items-center justify-center gap-1 rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground opacity-60">
                  <Play className="size-3" /> Coming Soon
                </button>
              </div>
            </Card>
          ))}
        </div>

        {!games?.length && (
          <p className="py-10 text-center text-sm text-muted-foreground">No games available yet.</p>
        )}
      </div>
    </div>
  );
}
