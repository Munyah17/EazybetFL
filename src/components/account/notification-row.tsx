"use client";

import { useState } from "react";
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
        "flex w-full flex-col gap-0.5 border-b border-border/60 px-4 py-3 text-left last:border-0",
        !read && "bg-primary/5"
      )}
    >
      <div className="flex items-center gap-2">
        {!read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
        <span className="text-sm font-medium">{notification.title}</span>
      </div>
      <p className="pl-3.5 text-xs text-muted-foreground">{notification.message}</p>
      <p className="pl-3.5 text-[11px] text-muted-foreground">
        {new Date(notification.created_at).toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </button>
  );
}
