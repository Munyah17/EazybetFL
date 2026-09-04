import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { paynowPoll, isPaynowPaid } from "@/lib/paynow/client";
import { rateLimited } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/send";
import { depositVerificationRequestedEmail } from "@/lib/email/templates";
import { formatMoney } from "@/lib/format";
import { logError } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: depositId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const limited = await rateLimited(`deposit-verify:${user.id}`, 5, 3600);
  if (limited) return limited;

  const { data: deposit } = await supabase
    .from("deposits")
    .select("id, amount, status, user_id, client_correlator")
    .eq("id", depositId)
    .maybeSingle();

  if (!deposit || deposit.user_id !== user.id) {
    return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
  }
  if (deposit.status === "completed") {
    return NextResponse.json({ status: "completed" });
  }

  const admin = createAdminClient();

  // Best-effort: maybe Paynow can confirm it right now and no human review
  // is needed. Same idempotent completion path as every other route.
  if (deposit.client_correlator) {
    try {
      const poll = await paynowPoll(deposit.client_correlator);
      if (isPaynowPaid(poll.status ?? "")) {
        const { error } = await admin.rpc("fn_complete_deposit", { p_deposit_id: deposit.id });
        if (!error) return NextResponse.json({ status: "completed" });
      }
    } catch {
      // fall through to filing the manual request
    }
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const amountClaimed = Number(form.get("amount")) || null;
  const payerPhone = String(form.get("phone") ?? "").trim().slice(0, 32) || null;
  const payerReference = String(form.get("reference") ?? "").trim().slice(0, 128) || null;
  const note = String(form.get("note") ?? "").trim().slice(0, 1000) || null;
  const proof = form.get("proof");

  let proofPath: string | null = null;
  if (proof && typeof proof === "object" && "arrayBuffer" in proof) {
    const fileObj = proof as File;
    const ext = EXT[fileObj.type];
    if (!ext) return NextResponse.json({ error: "Proof must be an image or PDF" }, { status: 400 });
    if (fileObj.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Proof must be under 5 MB" }, { status: 400 });
    }
    const path = `${user.id}/${depositId}-${Date.now()}.${ext}`;
    const { error: uploadErr } = await admin.storage
      .from("deposit-proofs")
      .upload(path, Buffer.from(await fileObj.arrayBuffer()), {
        contentType: fileObj.type,
        upsert: false,
      });
    if (uploadErr) {
      await logError("api:deposits/verify-request", uploadErr.message, { depositId });
      return NextResponse.json({ error: "Could not upload proof. Try again." }, { status: 502 });
    }
    proofPath = path;
  }

  const { error: insertErr } = await admin.from("deposit_verification_requests").insert({
    deposit_id: depositId,
    user_id: user.id,
    amount_claimed: amountClaimed,
    payer_phone: payerPhone,
    payer_reference: payerReference,
    proof_path: proofPath,
    note,
  });

  if (insertErr) {
    // 23505 = the one-open-request-per-deposit partial unique index.
    if (insertErr.code === "23505") {
      return NextResponse.json({ error: "A verification request for this deposit is already pending." }, { status: 409 });
    }
    await logError("api:deposits/verify-request", insertErr.message, { depositId });
    return NextResponse.json({ error: "Could not submit request" }, { status: 500 });
  }

  try {
    if (user.email) {
      await sendEmail(
        user.email,
        "Deposit verification requested",
        depositVerificationRequestedEmail(formatMoney(Number(deposit.amount)))
      );
    }
  } catch (e) {
    await logError("api:deposits/verify-request", e, { depositId, step: "email" });
  }

  return NextResponse.json({ ok: true });
}
