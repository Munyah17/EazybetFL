"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/friendly-error";

export function useCreateSupportTicket() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function create(subject: string, message: string): Promise<string | null> {
    setLoading(true);
    const { data, error } = await supabase.rpc("fn_create_support_ticket", {
      p_subject: subject,
      p_message: message,
    });
    setLoading(false);
    if (error) {
      toast.error("Could not open ticket", { description: friendlyError(error) });
      return null;
    }
    toast.success("Support ticket opened");
    return data as string;
  }

  return { create, loading };
}

export function useReplySupportTicket() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function reply(ticketId: string, message: string): Promise<boolean> {
    setLoading(true);
    const { error } = await supabase.rpc("fn_reply_support_ticket", {
      p_ticket_id: ticketId,
      p_message: message,
    });
    setLoading(false);
    if (error) {
      toast.error("Could not send reply", { description: friendlyError(error) });
      return false;
    }
    return true;
  }

  return { reply, loading };
}

export function useSetTicketStatus() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function setStatus(ticketId: string, status: "open" | "resolved"): Promise<boolean> {
    setLoading(true);
    const { error } = await supabase.rpc("fn_set_ticket_status", { p_ticket_id: ticketId, p_status: status });
    setLoading(false);
    if (error) {
      toast.error("Could not update ticket", { description: friendlyError(error) });
      return false;
    }
    return true;
  }

  return { setStatus, loading };
}
