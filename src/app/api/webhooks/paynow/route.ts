import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaynowWebhookDetailed, isPaynowPaid } from "@/lib/paynow/client";
import { sendEmail } from "@/lib/email/send";
import { depositCompletedEmail } from "@/lib/email/templates";
import { formatMoney } from "@/lib/format";
import { logError, logWarn } from "@/lib/log";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const text = await req.text();
  const fields = Object.fromEntries(new URLSearchParams(text).entries());

  // Record every inbound hit before validation. If deposits are stuck and
  // this log stays empty, Paynow is not reaching us at all (resultUrl /
  // networking) rather than failing the hash check -- two very different
  // fixes. Visible on the super-admin Logs page.
  await logWarn("webhook:paynow", "inbound callback", {
    reference: fields.reference,
    status: fields.status,
    paynowreference: fields.paynowreference,
  });

  const verified = verifyPaynowWebhookDetailed(fields);
  if (!verified.valid) {
    await logError("webhook:paynow", "Invalid hash", {
      reference: fields.reference,
      receivedHash: fields.hash,
      fieldKeys: Object.keys(fields).join(","),
    });
    return NextResponse.json({ error: "Invalid hash" }, { status: 400 });
  }
  if (verified.matched === "canonical") {
    // Genuine callback, but only the documented-subset hash matched -- the
    // strict all-fields hash didn't. Paynow likely changed the field set;
    // revisit verifyPaynowWebhook before this becomes a hard failure.
    await logWarn("webhook:paynow", "hash matched canonical fallback, not strict", {
      reference: fields.reference,
      fieldKeys: Object.keys(fields).join(","),
    });
  }

  const reference = fields.reference;
  const admin = createAdminClient();
  const { data: deposit } = await admin
    .from("deposits")
    .select("id, status, amount, method, user_id, profiles(email)")
    .eq("id", reference)
    .maybeSingle();

  if (!deposit) {
    await logError("webhook:paynow", "Unknown deposit reference", { reference });
    return NextResponse.json({ error: "Unknown deposit" }, { status: 404 });
  }
  if (deposit.status === "completed") return NextResponse.json({ ok: true });

  await admin.from("deposits").update({ provider_payload: fields }).eq("id", deposit.id);

  if (isPaynowPaid(fields.status ?? "")) {
    const { error: completeErr } = await admin.rpc("fn_complete_deposit", { p_deposit_id: deposit.id });
    if (completeErr) {
      await logError("webhook:paynow", completeErr.message, { depositId: deposit.id, step: "fn_complete_deposit" });
      return NextResponse.json({ error: "Failed to complete deposit" }, { status: 500 });
    }
    // Isolated: an email failure must not turn a 200 (deposit already
    // completed) into a 500 that makes Paynow think the webhook itself
    // failed and worth retrying.
    try {
      const email = deposit.profiles?.email;
      if (email) {
        await sendEmail(
          email,
          "Deposit received",
          depositCompletedEmail(formatMoney(Number(deposit.amount)), deposit.method)
        );
      }
    } catch (e) {
      await logError("webhook:paynow", e, { depositId: deposit.id, step: "confirmation_email" });
    }
  } else if ((fields.status ?? "").toLowerCase() === "cancelled") {
    await admin.rpc("fn_fail_deposit", { p_deposit_id: deposit.id });
    await admin.from("deposits").update({ status: "failed" }).eq("id", deposit.id);
  }

  return NextResponse.json({ ok: true });
}
