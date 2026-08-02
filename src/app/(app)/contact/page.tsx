import { Mail, MessageCircle, Phone, Clock, MapPin } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Contact Us | EazyBet" };

const CHANNELS = [
  { icon: Mail, label: "Email", value: "support@eazybet.co.zw", href: "mailto:support@eazybet.co.zw" },
  { icon: MessageCircle, label: "WhatsApp", value: "+263 XX XXX XXXX", href: undefined },
  { icon: Phone, label: "Phone", value: "+263 XX XXX XXXX", href: undefined },
  { icon: Clock, label: "Support Hours", value: "Mon–Sun, 08:00–22:00 CAT", href: undefined },
  { icon: MapPin, label: "Head Office", value: "Harare, Zimbabwe", href: undefined },
];

export default function ContactPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Contact Us" backHref="/" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
        <p className="rounded-lg border border-border/60 bg-card p-4 text-xs text-muted-foreground">
          Placeholder contact details — replace with your real support email,
          WhatsApp/phone numbers, and office address before launch.
        </p>

        <Card className="gap-0 overflow-hidden border-border/60 bg-card p-0">
          {CHANNELS.map((c) => (
            <div key={c.label} className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5 last:border-0">
              <c.icon className="size-4.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                {c.href ? (
                  <a href={c.href} className="text-sm font-medium text-primary hover:underline">
                    {c.value}
                  </a>
                ) : (
                  <p className="text-sm font-medium">{c.value}</p>
                )}
              </div>
            </div>
          ))}
        </Card>

        <p className="px-1 text-xs text-muted-foreground">
          For account-specific issues (deposits, withdrawals, bets), signing
          in and reaching out via the details above helps us verify and
          resolve things faster. General questions are also covered in the{" "}
          <a href="/help" className="text-primary hover:underline">
            Help Centre
          </a>
          .
        </p>
      </div>
    </div>
  );
}
