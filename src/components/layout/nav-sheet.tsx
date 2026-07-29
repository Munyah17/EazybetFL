"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Menu,
  User,
  Wallet,
  Ticket,
  Bookmark,
  Gift,
  Dices,
  ShieldCheck,
  Handshake,
  LogOut,
  LogIn,
  UserPlus,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSession } from "@/lib/auth/session-provider";
import { CASINO_URL } from "@/lib/constants";

export function NavSheet() {
  const [open, setOpen] = useState(false);
  const { profile, signOut } = useSession();
  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const isAgent = profile?.role === "agent";

  const links = [
    { href: "/", label: "Home", icon: Home },
    { href: CASINO_URL, label: "Spineazy Casino", icon: Dices, external: true },
    { href: "/promotions", label: "Promotions", icon: Gift },
    ...(profile
      ? [
          { href: "/account", label: "My Account", icon: User },
          { href: "/wallet", label: "Wallet", icon: Wallet },
          { href: "/bets", label: "My Bets", icon: Ticket },
          { href: "/booked-bets", label: "Booked Bets", icon: Bookmark },
        ]
      : []),
    ...(isAgent ? [{ href: "/agent", label: "Agent Dashboard", icon: Handshake }] : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin Dashboard", icon: ShieldCheck }] : []),
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-sidebar p-0">
        {/* SheetContent already renders its own close (X) button pinned to
         * top-3 right-3 -- nothing else can share that corner without
         * overlapping it, so this header only holds the logo. */}
        <SheetHeader className="border-b border-border px-4 py-4 pr-12">
          <SheetTitle>
            <Logo />
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              target={l.external ? "_blank" : undefined}
              rel={l.external ? "noopener noreferrer" : undefined}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/90 hover:bg-accent"
            >
              <l.icon className="size-4.5 text-muted-foreground" />
              {l.label}
            </Link>
          ))}
          <div className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/90">
            <span>Appearance</span>
            <ThemeToggle />
          </div>
        </nav>
        <Separator />
        <div className="p-3">
          {profile ? (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-destructive hover:text-destructive"
              onClick={() => {
                setOpen(false);
                signOut();
              }}
            >
              <LogOut className="size-4.5" />
              Log Out
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <Button asChild onClick={() => setOpen(false)}>
                <Link href="/sign-up">
                  <UserPlus className="size-4.5" /> Sign Up
                </Link>
              </Button>
              <Button asChild variant="outline" onClick={() => setOpen(false)}>
                <Link href="/sign-in">
                  <LogIn className="size-4.5" /> Sign In
                </Link>
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
