import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ecocashLookup,
  normalizeMsisdn,
  isSuccessStatusMessage,
  type EcoCashChargeResponse,
} from "@/lib/ecocash/client";
import { sendEmail } from "@/lib/email/send";
import { depositCompletedEmail } from "@/lib/email/templates";
import { formatMoney } from "@/lib/format";
import { logError } from "@/lib/log";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * notifyUrl callback for async production charge outcomes. The sandbox
 * resolves synchronously in the charge response, so this mostly matters
 * once real EcoCash traffic replaces sandbox credentials.
 *
 * EcoCash's notifyUrl carries no signature, and `clientCorrelator` is a
 * plain column a user can read off their own `deposits` row via RLS -- so
 * the inbound body cannot be trusted for the outcome (an attacker could
 * otherwise POST a fabricated "Successful" here and get a free credit).
 * Treat the callback only as a "check now" trigger and re-verify the real
 * status directly against EcoCash's own lookup API before crediting
 * anything, the same way the Paynow status route re-polls Paynow rather
 * than trusting a caller-supplied status.
 */
export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  if (!payload?.clientCorrelator) {
    return NextResponse.json({ error: "Missing clientCorrelator" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: deposit } = await admin
    .from("deposits")
    .select("id, status, amount, phone_number, profiles(email)")
    .eq("client_correlator", payload.clientCorrelator)
    .maybeSingle();

  if (!deposit) return NextResponse.json({ error: "Unknown deposit" }, { status: 404 });
  if (deposit.status === "completed") return NextResponse.json({ ok: true });
  if (!deposit.phone_number) return NextResponse.json({ error: "Deposit missing phone" }, { status: 400 });

  let verified: EcoCashChargeResponse;
  try {
    verified = await ecocashLookup(normalizeMsisdn(deposit.phone_number), payload.clientCorrelator);
  } catch (e) {
    // Deliberately does not touch deposit status -- a failed verification
    // call is our side failing to check, not evidence the charge failed.
    // Left "processing"; reconcileStuckDeposits retries the same lookup.
    await logError("webhook:ecocash", e, { depositId: deposit.id });
    return NextResponse.json({ error: "Could not verify transaction" }, { status: 502 });
  }

  await admin
    .from("deposits")
    .update({ provider_payload: verified as unknown as Json })
    .eq("id", deposit.id);

  if (isSuccessStatusMessage(verified.statusMessage ?? "")) {
    const { error: completeErr } = await admin.rpc("fn_complete_deposit", { p_deposit_id: deposit.id });
    if (completeErr) await logError("webhook:ecocash", completeErr.message, { depositId: deposit.id, step: "fn_complete_deposit" });
    try {
      const email = deposit.profiles?.email;
      if (email) {
        await sendEmail(email, "Deposit received", depositCompletedEmail(formatMoney(Number(deposit.amount)), "EcoCash"));
      }
    } catch (e) {
      await logError("webhook:ecocash", e, { depositId: deposit.id, step: "confirmation_email" });
    }
  } else {
    await admin.rpc("fn_fail_deposit", { p_deposit_id: deposit.id });
    await admin.from("deposits").update({ status: "failed" }).eq("id", deposit.id);
  }

  return NextResponse.json({ ok: true });
}
