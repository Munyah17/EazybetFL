import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaynowWebhook, isPaynowPaid } from "@/lib/paynow/client";
import { sendEmail } from "@/lib/email/send";
import { depositCompletedEmail } from "@/lib/email/templates";
import { formatMoney } from "@/lib/format";
import { logError } from "@/lib/log";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const text = await req.text();
  const fields = Object.fromEntries(new URLSearchParams(text).entries());

  if (!verifyPaynowWebhook(fields)) {
    await logError("webhook:paynow", "Invalid hash", { reference: fields.reference });
    return NextResponse.json({ error: "Invalid hash" }, { status: 400 });
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
