"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useContainerWidth } from "@/hooks/use-container-width";
import {
  formatDashboardAxisValue,
  formatDashboardMetricValue,
  getDashboardMetricDefinition,
} from "@/lib/dashboard-metrics";
import type { DashboardTrendMetricKey, Platform } from "@/lib/types";

type SeriesPoint = {
  label: string;
  publishedAt: string;
  isPending: boolean;
  hasObservedData: boolean;
  observedMetrics: DashboardTrendMetricKey[];
  metrics: Record<DashboardTrendMetricKey, number>;
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  metricLabel: string;
  metricKey: DashboardTrendMetricKey;
};

function CustomTooltip({ active, payload, label, metricLabel, metricKey }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <div className="size-2 rounded-sm bg-series-views" />
        <span className="text-sm text-muted-foreground">{metricLabel}</span>
        <span className="text-sm font-medium text-foreground">
          {formatDashboardMetricValue(metricKey, payload[0].value)}
        </span>
      </div>
    </div>
  );
}

type Props = {
  metric: DashboardTrendMetricKey;
  points: SeriesPoint[];
  platform: Platform;
};

export function MetricAreaChart({ metric, points, platform: _platform }: Props) {
  const def = getDashboardMetricDefinition(metric);
  const { ref: containerRef, width: chartWidth } = useContainerWidth(800);

  const chartData = points.map((p) => ({
    date: p.label,
    value: p.observedMetrics.includes(metric) ? (p.metrics[metric] ?? null) : null,
  }));

  const hasData = chartData.some((d) => d.value !== null);

  // Show ~7 ticks regardless of how many data points there are
  const xAxisInterval = Math.max(0, Math.floor(chartData.length / 7) - 1);

  if (!hasData) {
    return (
      <div className="flex h-[280px] items-center justify-center border-t border-border bg-card">
        <p className="text-sm text-muted-foreground">Sin datos para este periodo.</p>
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-card p-4">
      <div className="mb-2 text-sm text-muted-foreground">{def.label}</div>
      <div ref={containerRef} className="h-[280px] w-full overflow-hidden">
        <AreaChart
          width={chartWidth}
          height={280}
          data={chartData}
          margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="metricGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--series-views)" stopOpacity={0.4} />
              <stop offset="50%" stopColor="var(--series-views)" stopOpacity={0.15} />
              <stop offset="100%" stopColor="var(--series-views)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--chart-grid)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--chart-label)", fontSize: 11 }}
            tickMargin={10}
            interval={xAxisInterval}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--chart-label)", fontSize: 11 }}
            tickFormatter={(v) => formatDashboardAxisValue(metric, v)}
            tickMargin={10}
            width={56}
          />
          <Tooltip
            content={
              <CustomTooltip
                metricLabel={def.shortLabel}
                metricKey={metric}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--series-views)"
            strokeWidth={2}
            fill="url(#metricGradient)"
            dot={false}
            activeDot={{ r: 4, fill: "var(--series-views)", stroke: "var(--series-views)" }}
            connectNulls={true}
          />
        </AreaChart>
      </div>
    </div>
  );
}
