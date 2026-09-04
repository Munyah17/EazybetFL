import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { paynowPoll, isPaynowPaid } from "@/lib/paynow/client";
import { logError } from "@/lib/log";

export const dynamic = "force-dynamic";

// Super-admin "re-check Paynow now" for a stuck deposit, from the
// verification review queue. Re-polls the gateway and completes through
// the shared idempotent path if -- and only if -- Paynow reports it paid.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: deposit } = await admin
    .from("deposits")
    .select("id, status, client_correlator")
    .eq("id", id)
    .maybeSingle();

  if (!deposit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (deposit.status === "completed") return NextResponse.json({ status: "completed" });
  if (!deposit.client_correlator) return NextResponse.json({ status: deposit.status, note: "No Paynow poll URL on record" });

  let poll;
  try {
    poll = await paynowPoll(deposit.client_correlator);
  } catch (e) {
    await logError("api:deposits/recheck", e, { depositId: id });
    return NextResponse.json({ status: "pending", note: "Paynow did not respond" });
  }

  if (isPaynowPaid(poll.status ?? "")) {
    const { error } = await admin.rpc("fn_complete_deposit", { p_deposit_id: id });
    if (error) {
      await logError("api:deposits/recheck", error.message, { depositId: id, step: "fn_complete_deposit" });
      return NextResponse.json({ status: "pending" });
    }
    return NextResponse.json({ status: "completed" });
  }

  return NextResponse.json({ status: "pending", paynowStatus: poll.status ?? "unknown" });
}
