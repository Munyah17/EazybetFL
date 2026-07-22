"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth/session-provider";

export function LogoutButton() {
  const { signOut, loading } = useSession();

  return (
    <Button
      variant="ghost"
      disabled={loading}
      onClick={signOut}
      className="w-full justify-center gap-2 text-destructive hover:text-destructive"
    >
      <LogOut className="size-4.5" />
      Log Out
    </Button>
  );
}
