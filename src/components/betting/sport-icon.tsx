import { Volleyball, CircleDot, Trophy, Gamepad2, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Volleyball,
  CircleDot,
  Trophy,
  Gamepad2,
};

export function SportIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = (name ? ICONS[name] : undefined) ?? Trophy;
  return <Icon className={className} />;
}
