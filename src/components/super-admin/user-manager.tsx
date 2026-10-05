"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Search, Settings2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export type ManagedUser = Pick<
  Profile,
  | "id"
  | "full_name"
  | "email"
  | "phone"
  | "account_number"
  | "role"
  | "status"
  | "country"
  | "date_of_birth"
  | "referral_code"
  | "referred_by"
  | "assigned_agent_id"
  | "commission_rate"
  | "created_at"
  | "last_login_at"
> & {
  balance: number | null;
  principal_balance: number | null;
  bonus_balance: number | null;
  locked_balance: number | null;
  currency: string;
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-primary/15 text-primary",
  suspended: "bg-boost/15 text-boost",
  banned: "bg-destructive/15 text-destructive",
};

const ROLE_STYLE: Record<string, string> = {
  super_admin: "bg-destructive/15 text-destructive",
  admin: "bg-boost/15 text-boost",
  agent: "bg-accent text-accent-foreground",
  user: "bg-muted text-muted-foreground",
};

function money(currency: string, amount: number | null) {
  if (amount === null) return "—";
  return `${currency} ${amount.toFixed(2)}`;
}

async function api(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/super-admin/users/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Operation failed");
  return json;
}

export function UserManager({ initialUsers }: { initialUsers: ManagedUser[] }) {
  const supabase = createClient();
  const { profile } = useSession();
  const [rows, setRows] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (!q) return true;
      return (
        u.full_name.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q) ||
        u.account_number.toLowerCase().includes(q)
      );
    });
  }, [rows, query, roleFilter, statusFilter]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((u) => u.status === "active").length,
      suspended: rows.filter((u) => u.status === "suspended").length,
      banned: rows.filter((u) => u.status === "banned").length,
    }),
    [rows]
  );

  function patchRow(id: string, patch: Partial<ManagedUser>) {
    setRows((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    setSelected((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  }

  async function setStatus(user: ManagedUser, nextStatus: Status) {
    if (user.id === profile?.id) {
      toast.error("You can't change your own account status");
      return;
    }
    if (user.role === "super_admin") {
      toast.error("Super admin accounts can't be suspended or banned from here");
      return;
    }
    setBusyId(user.id);
    const { error } = await supabase
      .from("profiles")
      .update({ status: nextStatus })
      .eq("id", user.id);
    setBusyId(null);
    if (error) {
      toast.error("Could not update status", { description: friendlyError(error) });
      return;
    }
    logAudit("status_change", "profile", user.id, { status: user.status }, { status: nextStatus });
    patchRow(user.id, { status: nextStatus });
    toast.success(
      nextStatus === "active"
        ? `${user.full_name} reactivated`
        : nextStatus === "suspended"
          ? `${user.full_name} suspended`
          : `${user.full_name} banned`
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card className="border-border/60 bg-card px-3 py-2">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-bold">{counts.total}</p>
        </Card>
        <Card className="border-border/60 bg-card px-3 py-2">
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="text-lg font-bold text-primary">{counts.active}</p>
        </Card>
        <Card className="border-border/60 bg-card px-3 py-2">
          <p className="text-xs text-muted-foreground">Suspended</p>
          <p className="text-lg font-bold text-boost">{counts.suspended}</p>
        </Card>
        <Card className="border-border/60 bg-card px-3 py-2">
          <p className="text-xs text-muted-foreground">Banned</p>
          <p className="text-lg font-bold text-destructive">{counts.banned}</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, phone or account #"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as "all" | Role)}>
          <SelectTrigger size="sm" className="w-32">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | Status)}>
          <SelectTrigger size="sm" className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="banned">Banned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
        {filtered.map((u) => {
          const isSelf = u.id === profile?.id;
          const locked = isSelf || u.role === "super_admin";
          return (
            <div
              key={u.id}
              className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2.5 last:border-0 sm:gap-3 sm:px-4 sm:py-3"
            >
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-sm font-medium">
                  {u.full_name}
                  {isSelf && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {u.email ?? u.phone ?? "—"} · #{u.account_number}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Joined {format(new Date(u.created_at), "d MMM yyyy")}
                  {u.last_login_at && (
                    <span className="hidden sm:inline">
                      {` · Last login ${format(new Date(u.last_login_at), "d MMM yyyy")}`}
                    </span>
                  )}
                </p>
              </div>
              <div className="w-20 text-right sm:w-24">
                <p className="text-sm font-medium tabular-nums">{money(u.currency, u.balance)}</p>
                {u.bonus_balance !== null && u.bonus_balance > 0 && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    +{money(u.currency, u.bonus_balance)} bonus
                  </p>
                )}
              </div>
              <Badge className={cn("border-0 text-[10px] capitalize", ROLE_STYLE[u.role])}>
                {u.role.replace("_", " ")}
              </Badge>
              <Badge className={cn("border-0 text-[10px] capitalize", STATUS_STYLE[u.status])}>
                {u.status}
              </Badge>
              <div className="flex items-center gap-1.5">
                {u.status === "active" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={locked || busyId === u.id}
                    onClick={() => setStatus(u, "suspended")}
                  >
                    Suspend
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={locked || busyId === u.id}
                    onClick={() => setStatus(u, "active")}
                  >
                    Activate
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => setSelected(u)}>
                  <Settings2 className="size-3.5" />
                  Manage
                </Button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No users found.</p>
        )}
      </Card>

      <UserDetailDialog
        user={selected}
        onClose={() => setSelected(null)}
        onPatch={patchRow}
        onDelete={(id) => {
          setRows((prev) => prev.filter((u) => u.id !== id));
          setSelected(null);
        }}
      />
    </div>
  );
}

function UserDetailDialog({
  user,
  onClose,
  onPatch,
  onDelete,
}: {
  user: ManagedUser | null;
  onClose: () => void;
  onPatch: (id: string, patch: Partial<ManagedUser>) => void;
  onDelete: (id: string) => void;
}) {
  const { profile } = useSession();
  if (!user) return null;
  const isSelf = user.id === profile?.id;
  const isSuperAdmin = user.role === "super_admin";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] gap-3 overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-1.5 pr-6">
            {user.full_name}
            <Badge className={cn("border-0 text-[10px] capitalize", ROLE_STYLE[user.role])}>
              {user.role.replace("_", " ")}
            </Badge>
            <Badge className={cn("border-0 text-[10px] capitalize", STATUS_STYLE[user.status])}>
              {user.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="profile" className="w-full">
          {/* Scrolls sideways on phones so all five tabs stay reachable without
              shrinking labels to unreadable sizes. */}
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <TabsList className="w-max min-w-full justify-start">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="access">Access</TabsTrigger>
              <TabsTrigger value="wallet">Wallet</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="profile">
            <ProfileTab user={user} isSelf={isSelf} onPatch={onPatch} />
          </TabsContent>
          <TabsContent value="access">
            <AccessTab user={user} isSelf={isSelf} isSuperAdmin={isSuperAdmin} onPatch={onPatch} />
          </TabsContent>
          <TabsContent value="wallet">
            <WalletTab user={user} onPatch={onPatch} />
          </TabsContent>
          <TabsContent value="security">
            <SecurityTab user={user} isSelf={isSelf} isSuperAdmin={isSuperAdmin} onDelete={onDelete} />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityTab user={user} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ProfileTab({
  user,
  isSelf,
  onPatch,
}: {
  user: ManagedUser;
  isSelf: boolean;
  onPatch: (id: string, patch: Partial<ManagedUser>) => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState({
    full_name: user.full_name,
    email: user.email ?? "",
    phone: user.phone ?? "",
    country: user.country ?? "",
    date_of_birth: user.date_of_birth ?? "",
    referral_code: user.referral_code ?? "",
    assigned_agent_id: user.assigned_agent_id ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const patch = {
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      country: form.country.trim() || null,
      date_of_birth: form.date_of_birth || null,
      referral_code: form.referral_code.trim() || null,
      assigned_agent_id: form.assigned_agent_id.trim() || null,
    };
    if (!patch.full_name) {
      setSaving(false);
      toast.error("Full name is required");
      return;
    }
    const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Could not update profile", { description: friendlyError(error) });
      return;
    }
    logAudit("profile_update", "profile", user.id, undefined, patch);
    onPatch(user.id, patch);
    toast.success("Profile updated");
  }

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="Full name"
          value={form.full_name}
          onChange={(v) => setForm((f) => ({ ...f, full_name: v }))}
        />
        <Field
          label="Email"
          value={form.email}
          type="email"
          onChange={(v) => setForm((f) => ({ ...f, email: v }))}
        />
        <Field
          label="Phone"
          value={form.phone}
          onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
        />
        <Field
          label="Country"
          value={form.country}
          onChange={(v) => setForm((f) => ({ ...f, country: v }))}
        />
        <Field
          label="Date of birth"
          value={form.date_of_birth}
          type="date"
          onChange={(v) => setForm((f) => ({ ...f, date_of_birth: v }))}
        />
        <Field
          label="Referral code"
          value={form.referral_code}
          onChange={(v) => setForm((f) => ({ ...f, referral_code: v }))}
        />
        <Field
          label="Assigned agent ID"
          value={form.assigned_agent_id}
          placeholder="UUID of an agent (blank = none)"
          onChange={(v) => setForm((f) => ({ ...f, assigned_agent_id: v }))}
        />
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Account #</Label>
          <Input value={user.account_number} disabled />
        </div>
      </div>
      <div className="flex justify-end">
        <Button size="sm" disabled={saving} onClick={save}>
          {saving ? "Saving…" : isSelf ? "Save (your profile)" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function AccessTab({
  user,
  isSelf,
  isSuperAdmin,
  onPatch,
}: {
  user: ManagedUser;
  isSelf: boolean;
  isSuperAdmin: boolean;
  onPatch: (id: string, patch: Partial<ManagedUser>) => void;
}) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [commission, setCommission] = useState(String(user.commission_rate));

  async function setRole(role: Role) {
    if (isSelf) {
      toast.error("You can't change your own role");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ role }).eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error("Could not update role", { description: friendlyError(error) });
      return;
    }
    logAudit("role_change", "profile", user.id, { role: user.role }, { role });
    onPatch(user.id, { role });
    toast.success(`Role changed to ${role.replace("_", " ")}`);
  }

  async function setStatus(status: Status) {
    if (isSelf) {
      toast.error("You can't change your own status");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ status }).eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error("Could not update status", { description: friendlyError(error) });
      return;
    }
    logAudit("status_change", "profile", user.id, { status: user.status }, { status });
    onPatch(user.id, { status });
    toast.success(`Status set to ${status}`);
  }

  async function saveCommission() {
    const rate = Number(commission);
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      toast.error("Enter a commission rate between 0 and 100");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ commission_rate: rate })
      .eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error("Could not update commission", { description: friendlyError(error) });
      return;
    }
    logAudit(
      "commission_rate_change",
      "profile",
      user.id,
      { commission_rate: user.commission_rate },
      { commission_rate: rate }
    );
    onPatch(user.id, { commission_rate: rate });
    toast.success("Commission rate updated");
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Role</Label>
        <div className="flex flex-wrap gap-2">
          {(["user", "agent", "admin", "super_admin"] as const).map((r) => (
            <Button
              key={r}
              size="sm"
              variant={user.role === r ? "default" : "outline"}
              disabled={isSelf || busy}
              onClick={() => setRole(r)}
            >
              {r.replace("_", " ")}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Account status</Label>
        <div className="flex flex-wrap gap-2">
          {(["active", "suspended", "banned"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={user.status === s ? "default" : "outline"}
              disabled={isSelf || isSuperAdmin || busy}
              onClick={() => setStatus(s)}
            >
              {s}
            </Button>
          ))}
        </div>
        {isSuperAdmin && (
          <p className="text-xs text-muted-foreground">
            Super admin accounts can&apos;t be suspended or banned.
          </p>
        )}
      </div>

      {user.role === "agent" && (
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Commission rate (%)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={100}
              step="0.1"
              className="w-28"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
            />
            <Button size="sm" variant="outline" disabled={busy} onClick={saveCommission}>
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function WalletTab({
  user,
  onPatch,
}: {
  user: ManagedUser;
  onPatch: (id: string, patch: Partial<ManagedUser>) => void;
}) {
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [bucket, setBucket] = useState<"balance" | "principal">("balance");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function adjust() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setBusy(true);
    try {
      const { wallet } = await api(user.id, {
        action: "wallet_adjust",
        direction,
        bucket,
        amount: value,
        description: reason,
      });
      onPatch(user.id, {
        balance: wallet.balance,
        principal_balance: wallet.principal_balance,
        bonus_balance: wallet.bonus_balance,
        locked_balance: wallet.locked_balance,
        currency: wallet.currency,
      });
      setAmount("");
      setReason("");
      toast.success(
        `${direction === "credit" ? "Credited" : "Debited"} ${user.currency} ${value.toFixed(2)} (${bucket})`
      );
    } catch (e) {
      toast.error("Adjustment failed", { description: friendlyError(e) });
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card className="border-border/60 px-3 py-2">
          <p className="text-xs text-muted-foreground">Winnings</p>
          <p className="text-sm font-bold tabular-nums">{money(user.currency, user.balance)}</p>
        </Card>
        <Card className="border-border/60 px-3 py-2">
          <p className="text-xs text-muted-foreground">Principal</p>
          <p className="text-sm font-bold tabular-nums">
            {money(user.currency, user.principal_balance)}
          </p>
        </Card>
        <Card className="border-border/60 px-3 py-2">
          <p className="text-xs text-muted-foreground">Bonus</p>
          <p className="text-sm font-bold tabular-nums">{money(user.currency, user.bonus_balance)}</p>
        </Card>
        <Card className="border-border/60 px-3 py-2">
          <p className="text-xs text-muted-foreground">Locked</p>
          <p className="text-sm font-bold tabular-nums">
            {money(user.currency, user.locked_balance)}
          </p>
        </Card>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground">Manual adjustment</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={direction} onValueChange={(v) => setDirection(v as "credit" | "debit")}>
            <SelectTrigger size="sm" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="credit">Credit</SelectItem>
              <SelectItem value="debit">Debit</SelectItem>
            </SelectContent>
          </Select>
          <Select value={bucket} onValueChange={(v) => setBucket(v as "balance" | "principal")}>
            <SelectTrigger size="sm" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="balance">Winnings</SelectItem>
              <SelectItem value="principal">Principal</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="Amount"
            className="w-32"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input
            placeholder="Reason (shown in ledger)"
            className="min-w-40 flex-1"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button size="sm" disabled={busy} onClick={adjust}>
            {busy ? "Applying…" : "Apply"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Adjustments are written to the wallet ledger as &quot;adjustment&quot; transactions and
          audited.
        </p>
      </div>
    </div>
  );
}

function SecurityTab({
  user,
  isSelf,
  isSuperAdmin,
  onDelete,
}: {
  user: ManagedUser;
  isSelf: boolean;
  isSuperAdmin: boolean;
  onDelete: (id: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(body: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      await api(user.id, body);
      toast.success(success);
      return true;
    } catch (e) {
      toast.error("Operation failed", { description: friendlyError(e) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground">Set new password</Label>
        <div className="flex gap-2">
          <Input
            type="password"
            placeholder="New password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="max-w-64"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={busy || password.length < 6}
            onClick={async () => {
              const ok = await run(
                { action: "set_password", password },
                "Password updated — user can sign in with it now"
              );
              if (ok) setPassword("");
            }}
          >
            Set Password
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground">Sessions</Label>
        <div>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || isSelf}
            onClick={() =>
              run({ action: "revoke_sessions" }, "All sessions revoked — user must sign in again")
            }
          >
            Force sign-out everywhere
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground">Send notification</Label>
        <div className="flex flex-col gap-2">
          <Input
            placeholder="Title"
            value={notifTitle}
            onChange={(e) => setNotifTitle(e.target.value)}
          />
          <Input
            placeholder="Message"
            value={notifMessage}
            onChange={(e) => setNotifMessage(e.target.value)}
          />
          <div>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !notifTitle.trim() || !notifMessage.trim()}
              onClick={async () => {
                const ok = await run(
                  { action: "send_notification", title: notifTitle, message: notifMessage },
                  "Notification sent"
                );
                if (ok) {
                  setNotifTitle("");
                  setNotifMessage("");
                }
              }}
            >
              Send
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-destructive/40 p-3">
        <p className="mb-2 text-xs font-semibold text-destructive">Danger zone</p>
        {isSelf || isSuperAdmin ? (
          <p className="text-xs text-muted-foreground">
            {isSelf
              ? "You can't delete your own account."
              : "Demote this super admin before deleting their account."}
          </p>
        ) : !confirmDelete ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            Delete account…
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">
              This permanently deletes the account and profile. Are you sure?
            </p>
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                const ok = await run({ action: "delete_account" }, "Account deleted");
                if (ok) onDelete(user.id);
              }}
            >
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

type ActivityState = {
  bets: { id: string; stake: number; status: string; placed_at: string }[];
  txs: { id: string; type: string; amount: number; description: string | null; created_at: string }[];
  audits: { id: string; action: string; created_at: string }[];
  loaded: boolean;
};

function ActivityTab({ user }: { user: ManagedUser }) {
  const supabase = createClient();
  const [state, setState] = useState<ActivityState>({ bets: [], txs: [], audits: [], loaded: false });

  async function load() {
    const [bets, txs, audits] = await Promise.all([
      supabase
        .from("bets")
        .select("id, stake, status, placed_at")
        .eq("user_id", user.id)
        .order("placed_at", { ascending: false })
        .limit(10),
      supabase
        .from("wallet_transactions")
        .select("id, type, amount, description, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("audit_logs")
        .select("id, action, created_at")
        .eq("entity_type", "profile")
        .eq("entity_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    setState({
      bets: bets.data ?? [],
      txs: txs.data ?? [],
      audits: audits.data ?? [],
      loaded: true,
    });
  }

  if (!state.loaded) {
    return (
      <div className="flex flex-col items-center gap-2 py-8">
        <p className="text-sm text-muted-foreground">Load recent activity for this user.</p>
        <Button size="sm" variant="outline" onClick={load}>
          Load activity
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 pt-2 md:grid-cols-3">
      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Recent bets</p>
        <div className="flex flex-col gap-1.5">
          {state.bets.map((b) => (
            <div key={b.id} className="rounded-md border border-border/60 px-2 py-1.5 text-xs">
              <span className="font-medium tabular-nums">${b.stake.toFixed(2)}</span>
              <span className="ml-2 capitalize text-muted-foreground">{b.status}</span>
              <span className="block text-muted-foreground">
                {format(new Date(b.placed_at), "d MMM, HH:mm")}
              </span>
            </div>
          ))}
          {state.bets.length === 0 && (
            <p className="text-xs text-muted-foreground">No bets yet.</p>
          )}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Wallet ledger</p>
        <div className="flex flex-col gap-1.5">
          {state.txs.map((t) => (
            <div key={t.id} className="rounded-md border border-border/60 px-2 py-1.5 text-xs">
              <span className="font-medium tabular-nums">
                {t.amount >= 0 ? "+" : ""}
                {t.amount.toFixed(2)}
              </span>
              <span className="ml-2 capitalize text-muted-foreground">
                {t.type.replace("_", " ")}
              </span>
              <span className="block truncate text-muted-foreground">
                {t.description ?? format(new Date(t.created_at), "d MMM, HH:mm")}
              </span>
            </div>
          ))}
          {state.txs.length === 0 && (
            <p className="text-xs text-muted-foreground">No transactions yet.</p>
          )}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Admin actions on user</p>
        <div className="flex flex-col gap-1.5">
          {state.audits.map((a) => (
            <div key={a.id} className="rounded-md border border-border/60 px-2 py-1.5 text-xs">
              <span className="font-medium">{a.action.replaceAll("_", " ")}</span>
              <span className="block text-muted-foreground">
                {format(new Date(a.created_at), "d MMM, HH:mm")}
              </span>
            </div>
          ))}
          {state.audits.length === 0 && (
            <p className="text-xs text-muted-foreground">No admin actions logged.</p>
          )}
        </div>
      </div>
    </div>
  );
}
