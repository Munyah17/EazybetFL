"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CreditCard, Smartphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { friendlyError } from "@/lib/friendly-error";

export type PaymentMethodSetting = {
  method: string;
  label: string;
  enabled: boolean;
  note: string | null;
  updated_at: string;
};

const ICONS: Record<string, typeof CreditCard> = {
  paynow: CreditCard,
  ecocash_instant: Smartphone,
};

export function PaymentMethodsManager({ settings }: { settings: PaymentMethodSetting[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(method: string, enabled: boolean) {
    setBusy(method);
    try {
      const res = await fetch("/api/super-admin/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, enabled }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      toast.success(`${json.method === "ecocash_instant" ? "EcoCash Instant" : json.method} ${enabled ? "enabled" : "disabled"}`);
      router.refresh();
    } catch (e) {
      toast.error("Could not update method", { description: friendlyError(e) });
    }
    setBusy(null);
  }

  return (
    <div className="flex flex-col gap-2">
      {settings.map((s) => {
        const Icon = ICONS[s.method] ?? CreditCard;
        return (
          <Card
            key={s.method}
            className="flex-row items-center justify-between gap-3 border-border/60 bg-card p-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Icon className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{s.label}</p>
                  <Badge
                    className={
                      s.enabled
                        ? "border-0 bg-primary/15 text-[10px] text-primary"
                        : "border-0 bg-muted text-[10px] text-muted-foreground"
                    }
                  >
                    {s.enabled ? "Live" : "Off"}
                  </Badge>
                </div>
                {s.note && <p className="truncate text-xs text-muted-foreground">{s.note}</p>}
              </div>
            </div>
            <Switch
              checked={s.enabled}
              disabled={busy === s.method}
              onCheckedChange={(v) => toggle(s.method, v)}
            />
          </Card>
        );
      })}
      {!settings.length && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No payment methods configured — run the latest migrations.
        </p>
      )}
    </div>
  );
}
