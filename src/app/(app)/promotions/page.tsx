import { Gift } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

export default async function PromotionsPage() {
  const supabase = await createClient();
  const { data: promotions } = await supabase
    .from("promotions")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col">
      <PageHeader title="Promotions" backHref="/" />
      <div className="flex flex-col gap-3 p-4">
        {(promotions ?? []).map((p) => (
          <Card key={p.id} className="gap-2 border-border/60 bg-card p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
                <Gift className="size-4.5 text-primary" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold">{p.title}</h3>
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {p.type.replace("_", " ")}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
              </div>
            </div>
            {p.terms && <p className="text-xs text-muted-foreground">{p.terms}</p>}
          </Card>
        ))}
        {!promotions?.length && (
          <p className="py-16 text-center text-sm text-muted-foreground">No active promotions right now.</p>
        )}
      </div>
    </div>
  );
}
