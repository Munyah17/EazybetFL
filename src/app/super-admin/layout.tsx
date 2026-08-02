import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SuperAdminNav } from "@/components/super-admin/super-admin-nav";
import { Logo } from "@/components/layout/logo";
import { Badge } from "@/components/ui/badge";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/super-admin");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") redirect("/admin");

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/super-admin">
            <Logo />
          </Link>
          <Badge variant="secondary" className="text-[10px]">
            Super Admin
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-sm font-medium text-primary">
            Admin View
          </Link>
          <Link href="/" className="text-sm font-medium text-primary">
            Back to Site
          </Link>
        </div>
      </header>
      <SuperAdminNav />
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
