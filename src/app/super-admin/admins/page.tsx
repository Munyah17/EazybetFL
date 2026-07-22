import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AdminRolesTable } from "@/components/admin/admin-roles-table";

export default async function ManageAdminsPage() {
  const supabase = await createClient();
  const { data: admins } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .in("role", ["admin", "super_admin"])
    .order("full_name");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Link href="/super-admin" className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-bold">Manage Admins</h1>
      </div>
      <AdminRolesTable initialAdmins={admins ?? []} />
    </div>
  );
}
