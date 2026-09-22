"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export function NotificationRow({ notification }: { notification: Notification }) {
  const supabase = createClient();
  const [read, setRead] = useState(notification.read);

  return (
    <button
      onClick={async () => {
        if (read) return;
        setRead(true);
        await supabase.from("notifications").update({ read: true }).eq("id", notification.id);
      }}
      className={cn(
        "flex w-full items-start gap-3 border-b border-border/60 px-4 py-3.5 text-left last:border-0",
        // CoolAdmin pattern: unread items carry a colored left accent border
        // and a faint tint; read items sit flat on the card.
        !read && "border-l-2 border-l-primary bg-primary/5"
      )}
    >
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Bell className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{notification.title}</span>
          {!read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{notification.message}</span>
      </span>
      <span className="shrink-0 text-[11px] text-muted-foreground">
        {new Date(notification.created_at).toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </button>
  );
}
