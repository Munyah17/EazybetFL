import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuccessStatusMessage } from "@/lib/ecocash/client";

export const dynamic = "force-dynamic";

/**
 * notifyUrl callback for async production charge outcomes. The sandbox
 * resolves synchronously in the charge response, so this mostly matters
 * once real EcoCash traffic replaces sandbox credentials.
 */
export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  if (!payload?.clientCorrelator) {
    return NextResponse.json({ error: "Missing clientCorrelator" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: deposit } = await admin
    .from("deposits")
    .select("id, status")
    .eq("client_correlator", payload.clientCorrelator)
    .maybeSingle();

  if (!deposit) return NextResponse.json({ error: "Unknown deposit" }, { status: 404 });
  if (deposit.status === "completed") return NextResponse.json({ ok: true });

  await admin
    .from("deposits")
    .update({ provider_payload: payload })
    .eq("id", deposit.id);

  if (isSuccessStatusMessage(payload.statusMessage ?? "")) {
    await admin.rpc("fn_complete_deposit", { p_deposit_id: deposit.id });
  } else {
    await admin.rpc("fn_fail_deposit", { p_deposit_id: deposit.id });
    await admin.from("deposits").update({ status: "failed" }).eq("id", deposit.id);
  }

  return NextResponse.json({ ok: true });
}
