import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SuperAdminShell } from "@/components/super-admin/super-admin-shell";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { LoginForm } from "@/components/auth/login-form";

function PortalAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="portal flex min-h-svh flex-col items-center justify-center bg-background px-5 py-8">
      {/* CoolAdmin auth/maintenance pattern: centered white card on the
          light page background. */}
      <div className="mx-auto w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-md">
        {children}
      </div>
    </div>
  );
}

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <PortalAuthShell>
        <div className="mb-6 text-center">
          <Link href="/" aria-label="EazyBet home" className="mx-auto mb-3 flex justify-center">
            <Logo className="text-2xl" />
          </Link>
          <h1 className="text-xl font-bold">Super Admin Login</h1>
          <p className="mt-1 text-sm text-muted-foreground">Restricted access.</p>
        </div>
        <LoginForm
          redirectTo="/super-admin"
          allowedRoles={["super_admin"]}
          invalidRoleMessage="This login is for EazyBet super admins only."
        />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Not a super admin?{" "}
          <Link href="/login" className="font-semibold text-primary">
            Go to the regular sign in
          </Link>
        </p>
      </PortalAuthShell>
    );
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  // An admin (just not a super admin) gets sent to the portal they do have
  // -- only genuinely unrelated accounts see a hard access-denied screen.
  if (profile?.role === "admin") redirect("/admin");

  if (profile?.role !== "super_admin") {
    return (
      <PortalAuthShell>
        <div className="flex flex-col items-center gap-3 text-center">
          <ShieldAlert className="size-10 text-destructive" />
          <h1 className="text-lg font-bold">Access Denied</h1>
          <p className="text-sm text-muted-foreground">
            This portal is for EazyBet super admins only. Your account doesn&apos;t have access.
          </p>
          <Button asChild className="mt-2">
            <Link href="/">Back to EazyBet</Link>
          </Button>
        </div>
      </PortalAuthShell>
    );
  }

  return <SuperAdminShell>{children}</SuperAdminShell>;
}
