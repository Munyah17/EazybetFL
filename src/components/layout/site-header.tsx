"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { NavSheet } from "@/components/layout/nav-sheet";
import { useSession } from "@/lib/auth/session-provider";
import { formatMoney } from "@/lib/format";

export function SiteHeader() {
  const { profile, wallet } = useSession();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <NavSheet />
        <Link href="/" aria-label="EazyBet home">
          <Logo />
        </Link>
      </div>

      {profile ? (
        <Link
          href="/wallet"
          className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-accent"
        >
          {formatMoney(wallet?.balance ?? 0)}
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Plus className="size-3.5" />
          </span>
        </Link>
      ) : (
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Sign In</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/sign-up">Sign Up</Link>
          </Button>
        </div>
      )}
    </header>
  );
}
