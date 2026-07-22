"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { NavSheet } from "@/components/layout/nav-sheet";
import { useSession } from "@/lib/auth/session-provider";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const DESKTOP_LINKS = [
  { href: "/", label: "Home" },
  { href: "/live", label: "Live" },
  { href: "/sports", label: "Sports" },
  { href: "/casino", label: "Casino" },
  { href: "/promotions", label: "Promotions" },
];

export function SiteHeader() {
  const { profile, wallet } = useSession();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur lg:px-5">
      <div className="flex items-center gap-2 lg:gap-8">
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
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
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
      </div>

      <div className="flex items-center gap-3">
        {profile ? (
          <>
            <Link
              href="/account"
              className="hidden text-sm font-medium text-foreground/80 hover:text-foreground lg:block"
            >
              My Account
            </Link>
            <Link
              href="/wallet"
              className="flex items-center gap-2 rounded bg-secondary px-3 py-1.5 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-accent"
            >
              {formatMoney(wallet?.balance ?? 0)}
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Plus className="size-3.5" />
              </span>
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
