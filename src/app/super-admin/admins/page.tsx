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
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-bold">Manage Admins</h1>
      <AdminRolesTable initialAdmins={admins ?? []} />
    </div>
  );
}
