"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/friendly-error";
import { logAudit } from "@/lib/audit-log";
import type { Json } from "@/types/database";

type Request = {
  id: string;
  deposit_id: string;
  amount_claimed: number | null;
  payer_phone: string | null;
  payer_reference: string | null;
  proof_path: string | null;
  note: string | null;
  status: string;
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  deposits: {
    amount: number;
    status: string;
    method: string;
    provider: string;
    client_correlator: string | null;
    provider_payload: Json | null;
    created_at: string;
  } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-boost/15 text-boost",
  approved: "bg-primary/15 text-primary",
  rejected: "bg-destructive/15 text-destructive",
};

export function DepositVerificationRow({ request, proofUrl }: { request: Request; proofUrl?: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState<"recheck" | "approve" | "reject" | null>(null);
  const [note, setNote] = useState("");

  const amount = Number(request.deposits?.amount ?? request.amount_claimed ?? 0);
  const isPending = request.status === "pending";

  async function recheck() {
    setBusy("recheck");
    try {
      const res = await fetch(`/api/deposits/${request.deposit_id}/recheck`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data.status === "completed") {
        toast.success("Paynow confirms paid — wallet credited");
        router.refresh();
      } else if (!res.ok) {
        toast.error("Re-check failed", { description: data.error });
      } else {
        toast.info(`Paynow status: ${data.paynowStatus ?? data.status}${data.note ? ` (${data.note})` : ""}`);
      }
    } finally {
      setBusy(null);
    }
  }

  async function review(approve: boolean) {
    if (!approve && !note.trim()) {
      toast.error("Add a note explaining the rejection");
      return;
    }
    setBusy(approve ? "approve" : "reject");
    const { error } = await supabase.rpc("fn_review_deposit_verification", {
      p_request_id: request.id,
      p_approve: approve,
      p_admin_note: note.trim() || undefined,
    });
    setBusy(null);
    if (error) {
      toast.error("Could not save", { description: friendlyError(error) });
      return;
    }
    toast.success(approve ? "Approved — wallet credited" : "Rejected");
    logAudit(
      approve ? "deposit_verification_approved" : "deposit_verification_rejected",
      "deposit_verification_request",
      request.id,
      undefined,
      { deposit_id: request.deposit_id, note: note.trim() || null }
    );
    fetch("/api/notify/deposit-verification-decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: request.id, approved: approve, reason: note.trim() || undefined }),
    }).catch(() => {});
    router.refresh();
  }

  return (
    <Card className="flex-col gap-3 border-border/60 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{request.profiles?.full_name ?? "Unknown"}</span>
            <Badge className={cn("border-0 text-[10px] capitalize", STATUS_STYLE[request.status])}>
              {request.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{request.profiles?.email}</p>
          <p className="text-xs text-muted-foreground">
            Filed{" "}
            {new Date(request.created_at).toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <span className="shrink-0 text-sm font-bold">{formatMoney(amount)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-secondary/40 p-3 text-xs">
        <div>
          <span className="text-muted-foreground">Deposit status</span>
          <p className="font-medium">{request.deposits?.status ?? "—"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Method</span>
          <p className="font-medium capitalize">{request.deposits?.method ?? "—"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">EcoCash number</span>
          <p className="font-medium">{request.payer_phone ?? "—"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Confirmation ref</span>
          <p className="font-medium break-all">{request.payer_reference ?? "—"}</p>
        </div>
      </div>

      {request.note && <p className="text-xs text-muted-foreground">“{request.note}”</p>}

      {proofUrl && (
        <a
          href={proofUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-primary underline"
        >
          View uploaded proof
        </a>
      )}

      {request.deposits?.provider_payload != null && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">Gateway payload</summary>
          <pre className="mt-1 overflow-x-auto rounded bg-secondary/40 p-2 text-[10px]">
            {JSON.stringify(request.deposits.provider_payload, null, 2)}
          </pre>
        </details>
      )}

      {request.admin_note && request.status !== "pending" && (
        <p className="text-xs text-muted-foreground">Note: {request.admin_note}</p>
      )}

      {isPending && (
        <div className="flex flex-col gap-2">
          <Input
            placeholder="Note (required to reject, optional to approve)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="text-xs"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={!!busy} onClick={recheck}>
              {busy === "recheck" ? "Checking…" : "Re-check Paynow"}
            </Button>
            <div className="flex-1" />
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => review(false)}>
              Reject
            </Button>
            <Button size="sm" disabled={!!busy} onClick={() => review(true)}>
              Approve
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
