import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PromoBanner({ title, description }: { title: string; description: string | null }) {
  return (
    <div className="relative mx-3 mt-3 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/25 via-card to-card p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-boost">Welcome Bonus</p>
      <h2 className="mt-1 text-2xl font-extrabold leading-tight">{title}</h2>
      {description && <p className="mt-1 max-w-[85%] text-sm text-muted-foreground">{description}</p>}
      <Button asChild size="sm" className="mt-3">
        <Link href="/wallet/deposit">Deposit Now</Link>
      </Button>
    </div>
  );
}
