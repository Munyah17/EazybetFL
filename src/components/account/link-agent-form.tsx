"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/friendly-error";

export function LinkAgentForm() {
  const supabase = createClient();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function link() {
    if (!code.trim()) return;
    setLoading(true);
    const { error } = await supabase.rpc("fn_link_agent", { p_agent_code: code.trim() });
    setLoading(false);
    if (error) {
      toast.error("Could not link agent", { description: friendlyError(error) });
      return;
    }
    toast.success("Linked to agent");
    setCode("");
    router.refresh();
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Have a cash agent&apos;s code? Link them for in-person deposits/withdrawals.
      </p>
      <div className="flex gap-2">
        <Input
          placeholder="Agent code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="uppercase"
        />
        <Button disabled={loading} onClick={link}>
          Link
        </Button>
      </div>
    </div>
  );
}
