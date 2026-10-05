import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // A live session has no business on the login page -- send everyone to the
  // homepage, never a portal. Staff portals are entered only by deliberately
  // visiting /admin or /super-admin; nothing public auto-routes into them.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

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
