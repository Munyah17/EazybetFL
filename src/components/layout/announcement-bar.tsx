"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Banner } from "@/lib/data/banners";

const STORAGE_KEY = "eazybet-dismissed-announcement";

export function AnnouncementBar({ announcement }: { announcement: Banner | null }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Reads dismissal state from an external system (localStorage).
    if (!announcement) return;
    const dismissedId = localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(dismissedId === announcement.id);
  }, [announcement]);

  if (!announcement || dismissed) return null;

  const accentClass =
    announcement.accent === "boost"
      ? "bg-boost/10 text-boost"
      : announcement.accent === "info"
        ? "bg-[#4ea8ff]/10 text-[#4ea8ff]"
        : "bg-primary/10 text-primary";

  return (
    <div className={cn("flex items-center justify-center gap-3 px-4 py-2 text-center text-xs font-medium", accentClass)}>
      <span className="truncate">
        <span className="font-bold">{announcement.title}</span>
        {announcement.description && <span className="ml-1.5 font-normal">{announcement.description}</span>}
      </span>
      {announcement.cta_label && announcement.cta_href && (
        <Link href={announcement.cta_href} className="shrink-0 underline underline-offset-2">
          {announcement.cta_label}
        </Link>
      )}
      <button
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, announcement.id);
          setDismissed(true);
        }}
        aria-label="Dismiss announcement"
        className="shrink-0 opacity-70 hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
