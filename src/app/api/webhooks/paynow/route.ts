import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaynowWebhook, isPaynowPaid } from "@/lib/paynow/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const text = await req.text();
  const fields = Object.fromEntries(new URLSearchParams(text).entries());

  if (!verifyPaynowWebhook(fields)) {
    return NextResponse.json({ error: "Invalid hash" }, { status: 400 });
  }

  const reference = fields.reference;
  const admin = createAdminClient();
  const { data: deposit } = await admin
    .from("deposits")
    .select("id, status")
    .eq("id", reference)
    .maybeSingle();

  if (!deposit) return NextResponse.json({ error: "Unknown deposit" }, { status: 404 });
  if (deposit.status === "completed") return NextResponse.json({ ok: true });

  await admin.from("deposits").update({ provider_payload: fields }).eq("id", deposit.id);

  if (isPaynowPaid(fields.status ?? "")) {
    await admin.rpc("fn_complete_deposit", { p_deposit_id: deposit.id });
  } else if ((fields.status ?? "").toLowerCase() === "cancelled") {
    await admin.rpc("fn_fail_deposit", { p_deposit_id: deposit.id });
    await admin.from("deposits").update({ status: "failed" }).eq("id", deposit.id);
  }

  return NextResponse.json({ ok: true });
}
