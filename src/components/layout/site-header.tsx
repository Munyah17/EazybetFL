"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Logo } from "@/components/layout/logo";
import { NavSheet } from "@/components/layout/nav-sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSession } from "@/lib/auth/session-provider";
import { formatMoney, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CASINO_URL } from "@/lib/constants";

const DESKTOP_LINKS = [
  { href: "/", label: "Home" },
  { href: "/live", label: "Live" },
  { href: "/sports", label: "Sports" },
  { href: CASINO_URL, label: "Casino", external: true },
  { href: "/promotions", label: "Promotions" },
];

export function SiteHeader() {
  const { profile, wallet } = useSession();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur lg:px-5">
      <div className="flex items-center gap-2">
        <div className="lg:hidden">
          <NavSheet />
        </div>
        <Link href="/" aria-label="EazyBet home">
          <Logo />
        </Link>
      </div>

      <nav className="hidden items-center gap-1 lg:flex">
        {DESKTOP_LINKS.map((link) => {
          const active = !link.external && (link.href === "/" ? pathname === "/" : pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              className={cn(
                "px-3 py-2 text-sm font-semibold transition-colors",
                active ? "text-primary" : "text-foreground/80 hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Desktop: theme toggle, My Account, balance/auth. Mobile: just an
       * avatar (or auth buttons) -- everything else lives in the drawer. */}
      <div className="flex items-center justify-end gap-2">
        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          {profile && (
            <Link href="/account" className="text-sm font-medium text-foreground/80 hover:text-foreground">
              My Account
            </Link>
          )}
        </div>

        {profile ? (
          <>
            <Link
              href="/wallet"
              className="hidden items-center gap-2 rounded bg-secondary px-3 py-1.5 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-accent lg:flex"
            >
              {formatMoney(wallet?.balance ?? 0)}
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Plus className="size-3.5" />
              </span>
            </Link>
            <Link href="/account" className="lg:hidden" aria-label="My Account">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                  {initials(profile.full_name)}
                </AvatarFallback>
              </Avatar>
            </Link>
          </>
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
      </div>
    </header>
  );
}
