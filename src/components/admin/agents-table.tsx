"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/friendly-error";

type Agent = { id: string; full_name: string; email: string | null; role: string; commission_rate: number };

export function AgentsTable({ initialAgents }: { initialAgents: Agent[] }) {
  const supabase = createClient();
  const [agents, setAgents] = useState(initialAgents);
  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({});

  async function promoteByEmail() {
    if (!email.trim()) return;
    setSearching(true);
    const { data: found, error: findErr } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, commission_rate")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (findErr || !found) {
      setSearching(false);
      toast.error("No user found with that email");
      return;
    }
    if (found.role !== "user") {
      setSearching(false);
      toast.error("This user can't be made an agent");
      return;
    }

    const { error } = await supabase.from("profiles").update({ role: "agent" }).eq("id", found.id);
    setSearching(false);
    if (error) {
      toast.error("Could not promote user", { description: friendlyError(error) });
      return;
    }

    setAgents((prev) => [...prev, { ...found, role: "agent" }]);
    setEmail("");
    toast.success(`${found.full_name} is now an agent`);
  }

  async function demote(agent: Agent) {
    const { error } = await supabase.from("profiles").update({ role: "user" }).eq("id", agent.id);
    if (error) {
      toast.error("Could not demote agent", { description: friendlyError(error) });
      return;
    }
    setAgents((prev) => prev.filter((a) => a.id !== agent.id));
    toast.success("Agent demoted");
  }

  async function saveRate(agent: Agent) {
    const draft = rateDrafts[agent.id];
    const rate = Number(draft);
    if (draft === undefined || draft === "" || Number.isNaN(rate) || rate < 0 || rate > 100) {
      toast.error("Enter a commission rate between 0 and 100");
      return;
    }
    const { error } = await supabase.from("profiles").update({ commission_rate: rate }).eq("id", agent.id);
    if (error) {
      toast.error("Could not update commission rate", { description: friendlyError(error) });
      return;
    }
    setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, commission_rate: rate } : a)));
    setRateDrafts((prev) => {
      const next = { ...prev };
      delete next[agent.id];
      return next;
    });
    toast.success("Commission rate updated");
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-border/60 bg-card p-4">
        <p className="mb-2 text-sm font-semibold">Promote a user to Agent</p>
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
        {agents.map((a) => (
          <div
            key={a.id}
            className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">{a.email}</p>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              Agent
            </Badge>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                className="h-8 w-16 text-sm"
                placeholder={String(a.commission_rate)}
                value={rateDrafts[a.id] ?? ""}
                onChange={(e) => setRateDrafts((prev) => ({ ...prev, [a.id]: e.target.value }))}
              />
              <span className="text-xs text-muted-foreground">%</span>
              <Button size="sm" variant="outline" onClick={() => saveRate(a)}>
                Save
              </Button>
            </div>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => demote(a)}>
              Demote
            </Button>
          </div>
        ))}
        {agents.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No agents yet.</p>
        )}
      </Card>
    </div>
  );
}
