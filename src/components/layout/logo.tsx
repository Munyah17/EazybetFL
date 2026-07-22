import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("font-sans text-xl font-extrabold tracking-tight select-none", className)}>
      <span className="text-foreground">EAZY</span>
      <span className="text-primary">BET</span>
    </span>
  );
}
