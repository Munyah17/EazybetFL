import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Vercel sets this to the real client IP; falls back to a constant so a
 * missing header fails toward "one shared bucket" rather than "no limit
 * at all". */
export function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** Returns a 429 response if the key is over budget, otherwise null --
 * mirrors the requireCronSecret(req) => NextResponse | null pattern
 * already used for cron auth. */
export async function rateLimited(key: string, max: number, windowSeconds: number): Promise<NextResponse | null> {
  const supabase = createAdminClient();
  const { data: allowed, error } = await supabase.rpc("fn_check_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  // Fail open on an infra error -- a rate-limit outage shouldn't take
  // login/signup/deposits down with it.
  if (error) return null;
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Please wait a moment and try again." }, { status: 429 });
  }
  return null;
}
