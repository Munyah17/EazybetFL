"use client";

import { Copy, Gift } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth/session-provider";

export default function ReferralPage() {
  const { profile } = useSession();
  const code = profile?.referral_code ?? "";
  const link = typeof window !== "undefined" ? `${window.location.origin}/sign-up?ref=${code}` : "";

  return (
    <div className="flex flex-col">
      <PageHeader title="Refer & Earn" backHref="/account" />
      <div className="flex flex-col gap-4 p-4">
        <Card className="items-center border-border/60 bg-gradient-to-br from-primary/20 via-card to-card p-6 text-center">
          <Gift className="size-10 text-primary" />
          <h2 className="mt-2 text-lg font-bold">Invite friends, earn rewards</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Share your code. When a friend signs up and deposits, you both get a bonus.
          </p>
        </Card>

        <Card className="border-border/60 bg-card p-4">
          <p className="text-xs text-muted-foreground">Your Referral Code</p>
          <div className="mt-1 flex items-center justify-between rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 px-4 py-3">
            <span className="font-mono text-lg font-bold tracking-widest">{code}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(link);
                toast.success("Referral link copied");
              }}
            >
              <Copy className="size-4" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
