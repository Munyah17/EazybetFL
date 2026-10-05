"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { friendlyError } from "@/lib/friendly-error";
import { logAudit } from "@/lib/audit-log";
import { useSession } from "@/lib/auth/session-provider";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Role = Profile["role"];
type Status = Profile["status"];

export type StaffMember = Pick<
  Profile,
  | "id"
  | "full_name"
  | "email"
  | "phone"
  | "account_number"
  | "role"
  | "status"
  | "commission_rate"
  | "created_at"
  | "last_login_at"
>;

type StaffRole = Extract<Role, "admin" | "super_admin" | "agent">;

const ROLE_LABEL: Record<StaffRole, string> = {
  agent: "Agent",
  admin: "Admin",
  super_admin: "Super Admin",
};

const ROLE_STYLE: Record<string, string> = {
  super_admin: "bg-destructive/15 text-destructive",
  admin: "bg-boost/15 text-boost",
  agent: "bg-accent text-accent-foreground",
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-primary/15 text-primary",
  suspended: "bg-boost/15 text-boost",
  banned: "bg-destructive/15 text-destructive",
};

export function StaffManager({ initialStaff }: { initialStaff: StaffMember[] }) {
  const supabase = createClient();
  const { profile } = useSession();
  const [staff, setStaff] = useState(initialStaff);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | StaffRole>("all");
  const [lookup, setLookup] = useState("");
  const [newRole, setNewRole] = useState<StaffRole>("admin");
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff.filter((s) => {
      if (roleFilter !== "all" && s.role !== roleFilter) return false;
      if (!q) return true;
      return (
        s.full_name.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.account_number.toLowerCase().includes(q)
      );
    });
  }, [staff, query, roleFilter]);

  async function addStaff() {
    const needle = lookup.trim().toLowerCase();
    if (!needle) return;
    setSearching(true);
    const { data: found, error: findErr } = await supabase
      .from("profiles")
      .select(
        "id, full_name, email, phone, account_number, role, status, commission_rate, created_at, last_login_at"
      )
      .or(`email.eq.${needle},phone.eq.${lookup.trim()},account_number.eq.${needle}`)
      .maybeSingle();
    setSearching(false);

    if (findErr || !found) {
      toast.error("No user found with that email, phone or account number");
      return;
    }
    if (found.role !== "user") {
      toast.error(`${found.full_name} is already ${found.role.replace("_", " ")}`);
      return;
    }

    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", found.id);
    if (error) {
      toast.error("Could not add staff member", { description: friendlyError(error) });
      return;
    }
    logAudit("role_change", "profile", found.id, { role: "user" }, { role: newRole });
    setStaff((prev) => [...prev, { ...found, role: newRole } as StaffMember]);
    setLookup("");
    toast.success(`${found.full_name} is now ${ROLE_LABEL[newRole]}`);
  }

  async function setRole(member: StaffMember, role: Role) {
    if (member.id === profile?.id) {
      toast.error("You can't change your own role");
      return;
    }
    setBusyId(member.id);
    const { error } = await supabase.from("profiles").update({ role }).eq("id", member.id);
    setBusyId(null);
    if (error) {
      toast.error("Could not update role", { description: friendlyError(error) });
      return;
    }
    logAudit("role_change", "profile", member.id, { role: member.role }, { role });
    if (role === "user") {
      setStaff((prev) => prev.filter((s) => s.id !== member.id));
      toast.success(`${member.full_name} removed from staff`);
    } else {
      setStaff((prev) => prev.map((s) => (s.id === member.id ? { ...s, role } : s)));
      toast.success(`${member.full_name} is now ${ROLE_LABEL[role as StaffRole]}`);
    }
  }

  async function toggleStatus(member: StaffMember) {
    if (member.id === profile?.id) {
      toast.error("You can't change your own account status");
      return;
    }
    const nextStatus: Status = member.status === "active" ? "suspended" : "active";
    setBusyId(member.id);
    const { error } = await supabase
      .from("profiles")
      .update({ status: nextStatus })
      .eq("id", member.id);
    setBusyId(null);
    if (error) {
      toast.error("Could not update status", { description: friendlyError(error) });
      return;
    }
    logAudit(
      "status_change",
      "profile",
      member.id,
      { status: member.status },
      { status: nextStatus }
    );
    setStaff((prev) =>
      prev.map((s) => (s.id === member.id ? { ...s, status: nextStatus } : s))
    );
    toast.success(`${member.full_name} ${nextStatus === "active" ? "reactivated" : "suspended"}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-border/60 bg-card p-4">
        <p className="mb-2 text-sm font-semibold">Add a staff member</p>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Email, phone or account #"
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={newRole} onValueChange={(v) => setNewRole(v as StaffRole)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="agent">Agent</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button disabled={searching} onClick={addStaff}>
            {searching ? "Adding…" : "Add Staff"}
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search staff…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as "all" | StaffRole)}>
          <SelectTrigger size="sm" className="w-36">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
        {filtered.map((s) => {
          const isSelf = s.id === profile?.id;
          return (
            <div
              key={s.id}
              className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0"
            >
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-sm font-medium">
                  {s.full_name}
                  {isSelf && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.email ?? s.phone ?? "—"} · #{s.account_number}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.last_login_at
                    ? `Last login ${format(new Date(s.last_login_at), "d MMM yyyy")}`
                    : `Added ${format(new Date(s.created_at), "d MMM yyyy")}`}
                  {s.role === "agent" && ` · ${s.commission_rate}% commission`}
                </p>
              </div>
              <Badge className={cn("border-0 text-[10px] capitalize", ROLE_STYLE[s.role])}>
                {s.role.replace("_", " ")}
              </Badge>
              <Badge className={cn("border-0 text-[10px] capitalize", STATUS_STYLE[s.status])}>
                {s.status}
              </Badge>
              <div className="flex items-center gap-1.5">
                {s.role !== "super_admin" && (
                  <Select
                    value=""
                    disabled={isSelf || busyId === s.id}
                    onValueChange={(v) => {
                      if (v === "user") {
                        setRole(s, "user");
                      } else if (v !== s.role) {
                        setRole(s, v as Role);
                      }
                    }}
                  >
                    <SelectTrigger size="sm" className="w-32">
                      <SelectValue placeholder="Change role" />
                    </SelectTrigger>
                    <SelectContent>
                      {s.role !== "agent" && <SelectItem value="agent">Agent</SelectItem>}
                      {s.role !== "admin" && <SelectItem value="admin">Admin</SelectItem>}
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                      <SelectItem value="user">Remove from staff</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {s.role !== "super_admin" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSelf || busyId === s.id}
                    onClick={() => toggleStatus(s)}
                  >
                    {s.status === "active" ? "Suspend" : "Activate"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No staff members found.
          </p>
        )}
      </Card>
    </div>
  );
}
