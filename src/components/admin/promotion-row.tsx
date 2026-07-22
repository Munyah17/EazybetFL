"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";

type Promotion = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  value: number | null;
  active: boolean;
  created_at: string;
};

export function PromotionRow({ promotion }: { promotion: Promotion }) {
  const supabase = createClient();
  const [active, setActive] = useState(promotion.active);

  async function toggle(next: boolean) {
    setActive(next);
    const { error } = await supabase.from("promotions").update({ active: next }).eq("id", promotion.id);
    if (error) {
      toast.error("Could not update promotion", { description: error.message });
      setActive(!next);
      return;
    }
    toast.success(next ? "Promotion activated" : "Promotion deactivated");
  }

  return (
    <Card className="flex-row items-center justify-between gap-3 border-border/60 bg-card p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{promotion.title}</span>
          <Badge variant="secondary" className="text-[10px] capitalize">
            {promotion.type.replace("_", " ")}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{promotion.description}</p>
      </div>
      <Switch checked={active} onCheckedChange={toggle} />
    </Card>
  );
}
