"use client";

import { ArrowUp, ArrowDown } from "lucide-react";
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
  follows: number | null;
  previousFollows: number | null;
  series: SeriesPoint[];
};

function SparkTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { date: string } }> }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-1.5 shadow-lg">
      <p className="text-label text-muted-foreground">{item.payload.date}</p>
      <p className="text-xs font-medium text-success">
        +{formatCompactNumber(item.value)} seguidores
      </p>
    </div>
  );
}

export function FollowersSparklineCard({ follows, previousFollows, series }: Props) {
  const { ref: containerRef, width: chartWidth } = useContainerWidth(260);

  const sparkData = series.map((p) => ({
    date: p.label,
    value: p.observedMetrics.includes("follows") ? (p.metrics.follows ?? 0) : 0,
  }));

  const hasData = sparkData.some((d) => d.value > 0);

  let delta: number | null = null;
  if (
    typeof follows === "number" &&
    typeof previousFollows === "number" &&
    previousFollows > 0
  ) {
    delta = ((follows - previousFollows) / previousFollows) * 100;
  }

  const isUp = delta !== null && delta > 0;
  const isDown = delta !== null && delta < 0;

  return (
    <div className="border-r border-border p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Seguidores del período</div>
      </div>

      <div className="mt-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold text-foreground">
            {follows !== null ? formatCompactNumber(follows) : "—"}
          </span>
          {delta !== null ? (
            <div
              className={`flex items-center gap-0.5 text-xs ${
                isUp ? "text-success" : isDown ? "text-danger" : "text-muted-foreground"
              }`}
            >
              {isUp ? <ArrowUp className="size-3" /> : isDown ? <ArrowDown className="size-3" /> : null}
              <span>{Math.abs(delta).toFixed(1)}%</span>
            </div>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">seguidores ganados en el período</p>
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
              stroke="var(--series-views)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: "var(--series-views)", stroke: "var(--series-views)" }}
            />
          </LineChart>
        ) : null}
      </div>
    </div>
  );
}
