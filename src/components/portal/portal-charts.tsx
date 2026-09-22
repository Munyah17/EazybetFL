"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DailyPoint, StatusSlice } from "@/lib/portal-analytics";

/* All colors resolve through the .portal CSS variables, so charts follow
   the emerald theme and react to the light/dark toggle automatically. */
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-2)",
  "var(--chart-5)",
];

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--popover-foreground)",
  fontSize: 12,
} as const;

const axisStyle = { fontSize: 11, fill: "var(--muted-foreground)" } as const;

function ChartCard({
  title,
  subtitle,
  className,
  children,
}: {
  title: string;
  subtitle: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("gap-0 border-border/60 bg-card p-5", className)}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="h-64 w-full">{children}</div>
    </Card>
  );
}

/** CoolAdmin "Yearly sales" pattern: smooth area with a soft fill. */
export function AreaChartCard({
  title,
  subtitle,
  data,
  className,
}: {
  title: string;
  subtitle: string;
  data: DailyPoint[];
  className?: string;
}) {
  return (
    <ChartCard title={title} subtitle={subtitle} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="portalAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={48} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "var(--border)" }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#portalAreaFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** CoolAdmin "Team commits" pattern: doughnut with a legend row. */
export function DoughnutChartCard({
  title,
  subtitle,
  data,
  className,
}: {
  title: string;
  subtitle: string;
  data: StatusSlice[];
  className?: string;
}) {
  return (
    <ChartCard title={title} subtitle={subtitle} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            stroke="var(--card)"
            strokeWidth={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {data.map((d, i) => (
          <span key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="capitalize">{d.name}</span>
            <span className="font-semibold text-foreground">{d.value}</span>
          </span>
        ))}
      </div>
    </ChartCard>
  );
}

export type BarSeries = { key: string; label: string; color: string };

/** CoolAdmin "Bar chart" pattern: rounded bars on a light grid. Supports
 * one or more series (e.g. deposits vs withdrawals) keyed off `label`. */
export function BarChartCard({
  title,
  subtitle,
  data,
  series = [{ key: "value", label: "Value", color: "var(--chart-1)" }],
  className,
}: {
  title: string;
  subtitle: string;
  data: Record<string, string | number>[];
  series?: BarSeries[];
  className?: string;
}) {
  return (
    <ChartCard title={title} subtitle={subtitle} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={48} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={20} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      {series.length > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </ChartCard>
  );
}
