import { createClient } from "@/lib/supabase/server";
import { StaffManager, type StaffMember } from "@/components/super-admin/staff-manager";

export default async function StaffManagementPage() {
  const supabase = await createClient();
  const { data: staff } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, phone, account_number, role, status, commission_rate, created_at, last_login_at"
    )
    .in("role", ["admin", "super_admin", "agent"])
    .order("role")
    .order("full_name");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <h1 className="text-lg font-bold">Staff Management</h1>
      <StaffManager initialStaff={(staff ?? []) as StaffMember[]} />
    </div>
  );
}
