"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { useCreateSupportTicket } from "@/lib/use-support-tickets";

type Ticket = { id: string; subject: string; status: "open" | "resolved"; updated_at: string };

export default function SupportListPage() {
  const supabase = createClient();
  const router = useRouter();
  const { create, loading: creating } = useCreateSupportTicket();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("support_tickets")
      .select("id, subject, status, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setTickets(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time fetch on mount, not a state mirror
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate() {
    if (!subject.trim() || !message.trim()) return;
    const id = await create(subject.trim(), message.trim());
    if (id) {
      setOpen(false);
      setSubject("");
      setMessage("");
      router.push(`/account/support/${id}`);
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader title="Support" backHref="/account" />
      <div className="flex flex-col gap-4 p-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full">
              <Plus className="size-4" /> New Ticket
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Open a Support Ticket</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  className="min-h-24"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button disabled={creating || !subject.trim() || !message.trim()} onClick={handleCreate}>
                {creating ? "Opening…" : "Open Ticket"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No support tickets yet. Open one above, or see the{" "}
            <Link href="/help" className="text-primary hover:underline">
              Help Centre
            </Link>{" "}
            for common questions.
          </p>
        ) : (
          <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
            {tickets.map((t) => (
              <Link
                key={t.id}
                href={`/account/support/${t.id}`}
                className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5 last:border-0 hover:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.updated_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <Badge variant={t.status === "open" ? "secondary" : "outline"} className="shrink-0 text-[10px] capitalize">
                  {t.status}
                </Badge>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
