"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/auth/session-provider";

type Admin = { id: string; full_name: string; email: string | null; role: string };

export function AdminRolesTable({ initialAdmins }: { initialAdmins: Admin[] }) {
  const supabase = createClient();
  const { profile } = useSession();
  const [admins, setAdmins] = useState(initialAdmins);
  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);

  async function promoteByEmail() {
    if (!email.trim()) return;
    setSearching(true);
    const { data: found, error: findErr } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (findErr || !found) {
      setSearching(false);
      toast.error("No user found with that email");
      return;
    }
    if (found.role !== "user") {
      setSearching(false);
      toast.error("This user is already an admin");
      return;
    }

    const { error } = await supabase.from("profiles").update({ role: "admin" }).eq("id", found.id);
    setSearching(false);
    if (error) {
      toast.error("Could not promote user", { description: error.message });
      return;
    }

    setAdmins((prev) => [...prev, { ...found, role: "admin" }]);
    setEmail("");
    toast.success(`${found.full_name} is now an admin`);
  }

  async function setRole(admin: Admin, role: "admin" | "super_admin" | "user") {
    if (admin.id === profile?.id) {
      toast.error("You can't change your own role");
      return;
    }
    const { error } = await supabase.from("profiles").update({ role }).eq("id", admin.id);
    if (error) {
      toast.error("Could not update role", { description: error.message });
      return;
    }
    if (role === "user") {
      setAdmins((prev) => prev.filter((a) => a.id !== admin.id));
    } else {
      setAdmins((prev) => prev.map((a) => (a.id === admin.id ? { ...a, role } : a)));
    }
    toast.success("Role updated");
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-border/60 bg-card p-4">
        <p className="mb-2 text-sm font-semibold">Promote a user to Admin</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="user@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button disabled={searching} onClick={promoteByEmail}>
            Promote
          </Button>
        </div>
      </Card>

      <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
        {admins.map((a) => (
          <div key={a.id} className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">{a.email}</p>
            </div>
            <Badge variant="secondary" className="text-[10px] capitalize">
              {a.role.replace("_", " ")}
            </Badge>
            {a.role === "admin" ? (
              <Button size="sm" variant="outline" onClick={() => setRole(a, "super_admin")}>
                Make Super Admin
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setRole(a, "admin")}>
                Make Admin
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRole(a, "user")}>
              Demote
            </Button>
          </div>
        ))}
        {admins.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No admins yet.</p>
        )}
      </Card>
    </div>
  );
}
