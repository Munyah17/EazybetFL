import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Cookie-free client for public, non-user-specific reads (sidebar tree,
 * banners). Unlike lib/supabase/server.ts, this never touches cookies() --
 * required so callers can be wrapped in unstable_cache, which errors if a
 * dynamic API is used inside it. RLS already scopes these tables to public
 * reads of active/in-schedule rows only, same as the anon key gets from
 * the browser.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
