import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Staff accounts are offices, not customers -- an admin or super_admin
  // with a live session has no business on the public login page at all.
  // Send them straight to their own portal.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role === "super_admin") redirect("/super-admin");
    if (profile?.role === "admin") redirect("/admin");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-xl font-bold">Welcome Back!</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to continue</p>
      </div>
      {/* Staff never authenticate through the public login -- admins use
          /admin and super admins use /super-admin. The API signs the
          session out and returns a generic 401 so this form doesn't
          reveal privileged accounts. */}
      <LoginForm redirectTo={next || "/"} deniedRoles={["admin", "super_admin"]} showSocial showSignUpLink />
    </div>
  );
}
