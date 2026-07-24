import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates";

export const dynamic = "force-dynamic";

// Fired by the client right after a successful sign-up. Trusts only the
// caller's own authenticated session -- it can't be used to email anyone
// but the account that just signed in.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const fullName = (user.user_metadata?.full_name as string | undefined) ?? "there";
  await sendEmail(user.email, "Welcome to EazyBet", welcomeEmail(fullName));

  return NextResponse.json({ ok: true });
}
