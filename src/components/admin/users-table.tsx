"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type User = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "full_name" | "email" | "phone" | "role" | "status" | "created_at"
>;

const STATUS_STYLE: Record<string, string> = {
  active: "bg-primary/15 text-primary",
  suspended: "bg-boost/15 text-boost",
  banned: "bg-destructive/15 text-destructive",
};

export function UsersTable({ users }: { users: User[] }) {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState(users);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q)
    );
  }, [rows, query]);

  async function toggleStatus(user: User) {
    const nextStatus = user.status === "active" ? "suspended" : "active";
    const { error } = await supabase.from("profiles").update({ status: nextStatus }).eq("id", user.id);
    if (error) {
      toast.error("Could not update status", { description: error.message });
      return;
    }
    setRows((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)));
    toast.success(`User ${nextStatus}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
        {filtered.map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{u.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">{u.email ?? u.phone}</p>
            </div>
            <Badge variant="secondary" className="text-[10px] capitalize">
              {u.role.replace("_", " ")}
            </Badge>
            <Badge className={cn("border-0 text-[10px] capitalize", STATUS_STYLE[u.status])}>
              {u.status}
            </Badge>
            {u.role === "user" && (
              <Button size="sm" variant="outline" onClick={() => toggleStatus(u)}>
                {u.status === "active" ? "Suspend" : "Activate"}
              </Button>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No users found.</p>
        )}
      </Card>
    </div>
  );
}
