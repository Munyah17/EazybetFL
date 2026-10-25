import {
  Volleyball,
  CircleDot,
  Trophy,
  Gamepad2,
  Target,
  Shield,
  Swords,
  Goal,
  Snowflake,
  Flag,
  Disc,
  Disc2,
  Disc3,
  Hand,
  LandPlot,
  BicepsFlexed,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { SoccerBallIcon } from "@/components/betting/icons/soccer-ball-icon";

// DB-stored icon names (sport_groups.icon).
const ICONS: Record<string, LucideIcon | typeof SoccerBallIcon> = {
  Volleyball,
  CircleDot,
  Trophy,
  Gamepad2,
  SoccerBall: SoccerBallIcon,
};

// Per-sport mapping keyed by sport_groups.key -- the DB icon column is
// mostly generic fillers (CircleDot/Trophy), so this is where each sport
// gets its distinctive icon. Lucide has no dedicated ball glyphs for
// several sports; these are the closest sensible stand-ins.
const GROUP_ICONS: Record<string, LucideIcon | typeof SoccerBallIcon> = {
  soccer: SoccerBallIcon,
  basketball: Volleyball,
  tennis: Disc,
  cricket: Target,
  "rugby-union": Shield,
  "rugby-league": Shield,
  boxing: BicepsFlexed,
  "mixed-martial-arts": Swords,
  golf: Flag,
  "ice-hockey": Snowflake,
  handball: Hand,
  "american-football": Goal,
  baseball: Disc2,
  "aussie-rules": Zap,
  lacrosse: Disc3,
  politics: LandPlot,
};

export function SportIcon({
  name,
  groupKey,
  className,
}: {
  name: string | null;
  groupKey?: string;
  className?: string;
}) {
  const Icon = (groupKey && GROUP_ICONS[groupKey]) || (name ? ICONS[name] : undefined) || Trophy;
  return <Icon className={className} />;
}
