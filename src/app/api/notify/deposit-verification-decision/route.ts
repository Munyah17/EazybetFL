import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { depositVerificationDecisionEmail } from "@/lib/email/templates";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

// Fired by a super admin's browser right after fn_review_deposit_verification
// succeeds. The RPC already enforced the super-admin check and moved the
// money; this only sends the follow-up email, so it re-checks the caller and
// resolves the recipient via the service-role client.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const requestId = String(body?.requestId ?? "");
  const approved = Boolean(body?.approved);
  const reason = typeof body?.reason === "string" ? body.reason : undefined;
  if (!requestId) return NextResponse.json({ error: "Missing requestId" }, { status: 400 });

  const admin = createAdminClient();
  const { data: request } = await admin
    .from("deposit_verification_requests")
    .select("amount_claimed, deposits(amount), profiles(email)")
    .eq("id", requestId)
    .maybeSingle();

  const email = request?.profiles?.email;
  const amount = Number(request?.deposits?.amount ?? request?.amount_claimed ?? 0);
  if (request && email) {
    await sendEmail(
      email,
      approved ? "Deposit verified" : "Deposit could not be verified",
      depositVerificationDecisionEmail(formatMoney(amount), approved, reason)
    );
  }

  return NextResponse.json({ ok: true });
}
