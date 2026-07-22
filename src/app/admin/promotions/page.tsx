import { createClient } from "@/lib/supabase/server";
import { PromotionRow } from "@/components/admin/promotion-row";

export default async function AdminPromotionsPage() {
  const supabase = await createClient();
  const { data: promotions } = await supabase
    .from("promotions")
    .select("id, title, description, type, value, active, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-lg font-bold">Promotions</h1>
      <div className="flex flex-col gap-2">
        {(promotions ?? []).map((p) => (
          <PromotionRow key={p.id} promotion={p} />
        ))}
        {!promotions?.length && <p className="py-10 text-center text-sm text-muted-foreground">No promotions.</p>}
      </div>
    </div>
  );
}
