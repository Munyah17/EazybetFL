import { Volleyball, CircleDot, Trophy, Gamepad2, type LucideIcon } from "lucide-react";
import { SoccerBallIcon } from "@/components/betting/icons/soccer-ball-icon";

const ICONS: Record<string, LucideIcon | typeof SoccerBallIcon> = {
  Volleyball,
  CircleDot,
  Trophy,
  Gamepad2,
  SoccerBall: SoccerBallIcon,
};

export function SportIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = (name ? ICONS[name] : undefined) ?? Trophy;
  return <Icon className={className} />;
}
