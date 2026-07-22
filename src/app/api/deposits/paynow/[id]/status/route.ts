import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { paynowPoll, isPaynowPaid } from "@/lib/paynow/client";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: deposit } = await supabase
    .from("deposits")
    .select("id, status, client_correlator, user_id")
    .eq("id", id)
    .single();

  if (!deposit || deposit.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (deposit.status === "completed") return NextResponse.json({ status: "completed" });
  if (!deposit.client_correlator) return NextResponse.json({ status: deposit.status });

  const poll = await paynowPoll(deposit.client_correlator);
  const admin = createAdminClient();

  if (isPaynowPaid(poll.status ?? "")) {
    await admin.rpc("fn_complete_deposit", { p_deposit_id: deposit.id });
    return NextResponse.json({ status: "completed" });
  }
  if ((poll.status ?? "").toLowerCase() === "cancelled") {
    await admin.rpc("fn_fail_deposit", { p_deposit_id: deposit.id });
    await admin.from("deposits").update({ status: "failed" }).eq("id", deposit.id);
    return NextResponse.json({ status: "failed" });
  }

  return NextResponse.json({ status: "pending" });
}
