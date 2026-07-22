"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/types/database";

type Withdrawal = {
  id: string;
  amount: number;
  method: string;
  status: string;
  destination: Json;
  requested_at: string;
  profiles: { full_name: string } | null;
};

function destinationPhone(destination: Json): string {
  if (destination && typeof destination === "object" && !Array.isArray(destination) && "phone" in destination) {
    const phone = (destination as { phone?: unknown }).phone;
    return typeof phone === "string" ? phone : "-";
  }
  return "-";
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-boost/15 text-boost",
  approved: "bg-primary/15 text-primary",
  completed: "bg-primary/15 text-primary",
  rejected: "bg-destructive/15 text-destructive",
  failed: "bg-destructive/15 text-destructive",
};

export function WithdrawalRow({ withdrawal }: { withdrawal: Withdrawal }) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);

  async function approve() {
    setLoading("approve");
    const { error } = await supabase.rpc("fn_approve_withdrawal", { p_withdrawal_id: withdrawal.id });
    setLoading(null);
    if (error) {
      toast.error("Could not approve", { description: error.message });
      return;
    }
    toast.success("Withdrawal approved");
    router.refresh();
  }

  async function reject() {
    setLoading("reject");
    const { error } = await supabase.rpc("fn_reject_withdrawal", {
      p_withdrawal_id: withdrawal.id,
      p_reason: "Rejected by admin",
    });
    setLoading(null);
    if (error) {
      toast.error("Could not reject", { description: error.message });
      return;
    }
    toast.success("Withdrawal rejected and refunded");
    router.refresh();
  }

  return (
    <Card className="flex-row items-center justify-between gap-3 border-border/60 bg-card p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{withdrawal.profiles?.full_name}</span>
          <Badge className={cn("border-0 text-[10px] capitalize", STATUS_STYLE[withdrawal.status])}>
            {withdrawal.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground capitalize">
          {withdrawal.method.replace("_", " ")} · {destinationPhone(withdrawal.destination)}
        </p>
        <p className="text-xs text-muted-foreground">
          {new Date(withdrawal.requested_at).toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-bold">{formatMoney(withdrawal.amount)}</span>
        {withdrawal.status === "pending" && (
          <>
            <Button size="sm" variant="outline" disabled={!!loading} onClick={reject}>
              Reject
            </Button>
            <Button size="sm" disabled={!!loading} onClick={approve}>
              Approve
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
