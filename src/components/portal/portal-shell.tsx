"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowLeft, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/portal/theme-toggle";
import { cn } from "@/lib/utils";

export type PortalNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match pathname exactly instead of prefix-matching (for index routes). */
  exact?: boolean;
};

export type PortalNavSection = {
  /** Small uppercase group label, CoolAdmin-style. Omit for an unlabeled group. */
  label?: string;
  items: PortalNavItem[];
};

type PortalShellProps = {
  /** Shown in the top header next to the hamburger, e.g. "Admin Dashboard". */
  badge: string;
  sections: PortalNavSection[];
  children: React.ReactNode;
};

function isActive(pathname: string, item: PortalNavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

function SidebarNav({ sections, pathname }: { sections: PortalNavSection[]; pathname: string }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {sections.map((section, si) => (
        <div key={si} className={cn(si > 0 && "mt-5")}>
          {section.label && (
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
              {section.label}
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function SidebarBrand() {
  return (
    <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4">
      <span className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sm font-extrabold text-sidebar-primary-foreground">
        E
      </span>
      <span className="text-base font-extrabold tracking-tight text-sidebar-foreground">
        EAZY<span className="text-sidebar-primary">BET</span>
      </span>
    </div>
  );
}

function SidebarFooter() {
  return (
    <div className="shrink-0 border-t border-sidebar-border p-3">
      <Link
        href="/"
        className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
      >
        <ArrowLeft className="size-4 shrink-0" />
        Back to Site
      </Link>
    </div>
  );
}

/**
 * CoolAdmin-style portal shell: fixed dark sidebar on desktop, slide-over
 * drawer on mobile (hamburger in the header, backdrop dismiss, glides over
 * content without pushing it). All colors resolve through the .portal
 * sidebar tokens in globals.css.
 */
export function PortalShell({ badge, sections, children }: PortalShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer whenever the route changes -- adjust state during render
  // instead of an effect so there's no cascading re-render (and it satisfies
  // react-hooks/set-state-in-effect).
  const [seenPathname, setSeenPathname] = useState(pathname);
  if (seenPathname !== pathname) {
    setSeenPathname(pathname);
    setOpen(false);
  }

  return (
    <div className="portal min-h-svh bg-background">
      {/* Desktop sidebar -- fixed, always visible on lg+ */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <SidebarBrand />
        <SidebarNav sections={sections} pathname={pathname} />
        <SidebarFooter />
      </aside>

      {/* Mobile drawer -- slides over content, never pushes it */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          !open && "pointer-events-none"
        )}
        aria-hidden={!open}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/50 transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setOpen(false)}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-200 ease-out",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border pr-3">
            <SidebarBrand />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
          </div>
          <SidebarNav sections={sections} pathname={pathname} />
          <SidebarFooter />
        </aside>
      </div>

      {/* Content column -- offset by sidebar width on desktop only */}
      <div className="flex min-h-svh flex-col lg:pl-60">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card px-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <Badge variant="secondary" className="text-[10px]">
            {badge}
          </Badge>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
