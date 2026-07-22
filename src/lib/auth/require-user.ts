import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Middleware already redirects unauthenticated requests away from
 * protected prefixes, so this should always resolve -- but pages still
 * need the user/profile row, and this is the safety net if it doesn't. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/sign-in");

  return { supabase, user, profile };
}
