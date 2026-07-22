import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/layout/logo";
import { Badge } from "@/components/ui/badge";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/admin");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    redirect("/");
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Logo />
          </Link>
          <Badge variant="secondary" className="text-[10px]">
            Admin Dashboard
          </Badge>
        </div>
        <Link href="/" className="text-sm font-medium text-primary">
          Back to Site
        </Link>
      </header>
      <AdminNav isSuperAdmin={profile.role === "super_admin"} />
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
