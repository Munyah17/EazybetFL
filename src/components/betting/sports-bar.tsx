import Link from "next/link";
import { SportIcon } from "@/components/betting/sport-icon";
import { displayGroupName } from "@/lib/sport-display";

export function SportsBar({
  groups,
}: {
  groups: { id: string; key: string; name: string; icon: string | null }[];
}) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 py-3">
      {groups.map((g) => (
        <Link
          key={g.id}
          href={`/sports/${g.key}`}
          className="flex shrink-0 flex-col items-center gap-1.5 rounded-xl bg-card px-4 py-2.5 hover:bg-accent"
        >
          <SportIcon name={g.icon} className="size-5 text-primary" />
          <span className="text-[11px] font-medium text-muted-foreground">{displayGroupName(g.name)}</span>
        </Link>
      ))}
    </div>
  );
}
