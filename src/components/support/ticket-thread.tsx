"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { useReplySupportTicket, useSetTicketStatus } from "@/lib/use-support-tickets";

type Ticket = { id: string; subject: string; status: "open" | "resolved"; user_id: string };
type Message = { id: string; sender_id: string; sender_role: string; body: string; created_at: string };

export function TicketThread({ ticketId, isAdmin = false }: { ticketId: string; isAdmin?: boolean }) {
  const supabase = createClient();
  const { reply, loading: replying } = useReplySupportTicket();
  const { setStatus, loading: settingStatus } = useSetTicketStatus();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    const [{ data: t }, { data: msgs }, { data: auth }] = await Promise.all([
      supabase.from("support_tickets").select("id, subject, status, user_id").eq("id", ticketId).single(),
      supabase
        .from("support_ticket_messages")
        .select("id, sender_id, sender_role, body, created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true }),
      supabase.auth.getUser(),
    ]);
    setTicket(t);
    setMessages(msgs ?? []);
    setMeId(auth.user?.id ?? null);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount/ticket change, not a state mirror
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend() {
    if (!body.trim()) return;
    const ok = await reply(ticketId, body.trim());
    if (ok) {
      setBody("");
      await load();
    }
  }

  async function handleToggleStatus() {
    if (!ticket) return;
    const next = ticket.status === "open" ? "resolved" : "open";
    const ok = await setStatus(ticketId, next);
    if (ok) {
      toast.success(next === "resolved" ? "Ticket marked resolved" : "Ticket reopened");
      await load();
    }
  }

  if (loading || !ticket) {
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-semibold">{ticket.subject}</h1>
          <Badge variant={ticket.status === "open" ? "secondary" : "outline"} className="mt-1 text-[10px] capitalize">
            {ticket.status}
          </Badge>
        </div>
        {isAdmin && (
          <Button size="sm" variant="outline" disabled={settingStatus} onClick={handleToggleStatus}>
            {ticket.status === "open" ? (
              <>
                <CheckCircle2 className="size-4" /> Mark Resolved
              </>
            ) : (
              <>
                <RotateCcw className="size-4" /> Reopen
              </>
            )}
          </Button>
        )}
      </div>

      <Card className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto border-border/60 bg-card p-4">
        {messages.map((m) => {
          const mine = m.sender_id === meId;
          const isStaff = m.sender_role === "admin" || m.sender_role === "super_admin";
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                  mine ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                {!mine && isStaff && (
                  <p className="mb-0.5 text-[10px] font-semibold uppercase opacity-70">Support</p>
                )}
                <p className="whitespace-pre-wrap">{m.body}</p>
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {new Date(m.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </Card>

      <div className="flex gap-2">
        <Textarea
          placeholder="Type a message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-16 flex-1"
        />
        <Button onClick={handleSend} disabled={replying || !body.trim()} className="self-end">
          {replying ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}
