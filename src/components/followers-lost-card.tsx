"use client";

import { ArrowDown } from "lucide-react";
import { LineChart, Line, Tooltip } from "recharts";
import { useContainerWidth } from "@/hooks/use-container-width";
import { formatCompactNumber } from "@/lib/format";
import type { DashboardTrendMetricKey } from "@/lib/types";

type SeriesPoint = {
  label: string;
  publishedAt: string;
  observedMetrics: DashboardTrendMetricKey[];
  metrics: Record<DashboardTrendMetricKey, number>;
};

type Props = {
  followersLost: number | null;
  series: SeriesPoint[];
};

function SparkTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { date: string } }> }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-1.5 shadow-lg">
      <p className="text-label text-muted-foreground">{item.payload.date}</p>
      <p className="text-xs font-medium text-danger">
        -{formatCompactNumber(item.value)} seguidores
      </p>
    </div>
  );
}

export function FollowersLostCard({ followersLost, series }: Props) {
  const { ref: containerRef, width: chartWidth } = useContainerWidth(260);

  const sparkData = series.map((p) => ({
    date: p.label,
    value: p.observedMetrics.includes("follows")
      ? Math.max(0, -(p.metrics.follows ?? 0))
      : 0,
  }));

  const hasData = sparkData.some((d) => d.value > 0);

  return (
    <div className="border-r border-border p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Seguidores perdidos</div>
      </div>

      <div className="mt-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold text-danger">
            {followersLost !== null ? formatCompactNumber(followersLost) : "—"}
          </span>
          {followersLost !== null && followersLost > 0 ? (
            <div className="flex items-center gap-0.5 text-xs text-danger">
              <ArrowDown className="size-3" />
            </div>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">seguidores perdidos en el período</p>
      </div>

      <div ref={containerRef} className="mt-4 h-[44px] w-full overflow-hidden">
        {hasData ? (
          <LineChart width={chartWidth} height={44} data={sparkData}>
            <Tooltip
              content={<SparkTooltip />}
              cursor={{ stroke: "var(--chart-crosshair)", strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--series-skip)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: "var(--series-skip)", stroke: "var(--series-skip)" }}
            />
          </LineChart>
        ) : null}
      </div>
    </div>
  );
}
