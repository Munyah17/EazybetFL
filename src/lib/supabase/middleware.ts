import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

// /admin and /super-admin are deliberately excluded -- their layouts
// self-guard and show a portal-specific login screen instead of bouncing
// unauthenticated visitors to the general /login page.
const PROTECTED_PREFIXES = [
  "/account",
  "/wallet",
  "/bets",
  "/booked-bets",
  "/agent",
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));

  if (!user && isProtected) {
    // Preserve the full path *and query string* (e.g. ?depositId=... on the
    // Paynow return URL) -- using just .pathname here silently dropped it,
    // so re-authenticating after a session drop mid-checkout landed back on
    // the result page with no depositId, which that page treats as an
    // immediate "failed" regardless of what actually happened.
    const nextPath = request.nextUrl.pathname + request.nextUrl.search;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", nextPath);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
