import { Bell } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/require-user";
import { NotificationRow } from "@/components/account/notification-row";

export default async function NotificationsPage() {
  const { supabase, user } = await requireUser();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="flex flex-col">
      <PageHeader title="Notifications" backHref="/account" />
      <div className="flex flex-col gap-3 p-4">
        {!notifications?.length ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Bell className="size-8" />
            <p className="text-sm">No notifications yet.</p>
          </div>
        ) : (
          <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
            {notifications.map((n) => (
              <NotificationRow key={n.id} notification={n} />
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
