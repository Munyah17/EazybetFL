"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Radio, Trophy, Ticket, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBetslip } from "@/lib/betslip-store";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/sports", label: "Sports", icon: Trophy },
  { href: "/bets", label: "My Bets", icon: Receipt },
];

export function BottomNav() {
  const pathname = usePathname();
  const selections = useBetslip((s) => s.selections);
  const setOpen = useBetslip((s) => s.setOpen);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5 items-center">
        {items.slice(0, 2).map((item) => (
          <NavLink key={item.href} item={item} active={pathname === item.href} />
        ))}

        <button
          onClick={() => setOpen(true)}
          className="relative flex flex-col items-center gap-1 py-2.5 text-xs font-medium text-muted-foreground"
        >
          <span className="relative flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_0_4px_var(--background)]">
            <Ticket className="size-4.5" />
            {selections.length > 0 && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                {selections.length}
              </span>
            )}
          </span>
          Betslip
        </button>

        {items.slice(2).map((item) => (
          <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
        ))}
      </div>
    </nav>
  );
}

function NavLink({
  item,
  active,
}: {
  item: { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground"
      )}
    >
      <item.icon className="size-5" />
      {item.label}
    </Link>
  );
}
