import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimited, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** signInWithPassword moved server-side specifically so it can be rate
 * limited -- the Supabase browser client talks directly to Supabase's own
 * Auth API, which our backend never sees and can't throttle. Limited both
 * per-IP (blunt brute-force) and per-identifier (targeted account
 * brute-force from many IPs) -- either budget alone misses one of the two
 * attack shapes. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const allowedRoles: string[] | undefined = Array.isArray(body?.allowedRoles) ? body.allowedRoles : undefined;
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const ip = clientIp(req);
  const ipLimited = await rateLimited(`login:ip:${ip}`, 20, 300);
  if (ipLimited) return ipLimited;
  const identifierLimited = await rateLimited(`login:id:${email.toLowerCase()}`, 8, 300);
  if (identifierLimited) return identifierLimited;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Role check happens here, server-side, right after auth -- doing it
  // client-side afterward would need the browser client to notice a
  // cookie change made by this response before it could trust its own
  // session, which isn't guaranteed without an extra round trip.
  if (allowedRoles) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    if (!profile || !allowedRoles.includes(profile.role)) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: "access_denied" }, { status: 403 });
    }
  }

  return NextResponse.json({ ok: true });
}
