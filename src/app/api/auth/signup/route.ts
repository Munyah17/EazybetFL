import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimited, clientIp } from "@/lib/rate-limit";
import { normalizeZwPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

/** signUp moved server-side for the same reason as /api/auth/login --
 * only per-IP here (no existing identifier to key on yet, and signup is
 * inherently self-limiting once an email is taken). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const rawPhone = typeof body?.phone === "string" ? body.phone : null;

  if (!email || !password || !fullName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Authoritative normalization -- never trust the client's formatting.
  // A phone that was supplied but can't be parsed is rejected rather than
  // stored malformed (which is what broke phone login before).
  let phone: string | null = null;
  if (rawPhone && rawPhone.trim()) {
    phone = normalizeZwPhone(rawPhone);
    if (!phone) {
      return NextResponse.json({ error: "Enter a valid Zimbabwe mobile number, e.g. 0771234567" }, { status: 400 });
    }
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const ip = clientIp(req);
  const limited = await rateLimited(`signup:ip:${ip}`, 10, 3600);
  if (limited) return limited;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone } },
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
