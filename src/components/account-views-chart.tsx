"use client";

import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { formatCompactNumber } from "@/lib/format";
import { getPlatformLabel } from "@/lib/platforms";
import type { DashboardTrendMetricKey, Platform, PlatformConnection } from "@/lib/types";

type Props = {
  performanceTotals: Record<DashboardTrendMetricKey, number | null>;
  platform: Platform;
  availableConnections: PlatformConnection[];
  selectedConnectionId: string | null;
  connectionViewTotals: Array<{ connectionId: string; views: number }>;
};

// Neutral categorical ramp from the Rhea preset — accounts carry no inherent
// meaning, so they are distinguished by value rather than hue.
const CONNECTION_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
const IG_COLORS = CONNECTION_COLORS.slice(0, 4);

export function AccountViewsChart({
  performanceTotals,
  platform,
  availableConnections,
  selectedConnectionId,
  connectionViewTotals,
}: Props) {
  const totalViews = performanceTotals.views ?? 0;
  const colors = platform === "instagram" ? IG_COLORS : CONNECTION_COLORS;

  const connections = availableConnections.filter((c) => c.platform === platform);

  let data: { name: string; value: number; color: string }[];

  if (connections.length === 0) {
    data = [{ name: getPlatformLabel(platform), value: totalViews || 1, color: colors[0] }];
  } else if (connections.length === 1) {
    const conn = connections[0];
    data = [
      {
        name: conn.accountUsername ?? conn.displayName ?? conn.accountExternalId,
        value: totalViews || 1,
        color: colors[0],
      },
    ];
  } else {
    data = connections.map((conn, i) => {
      const connViews = connectionViewTotals.find((t) => t.connectionId === conn.id)?.views ?? 0;
      return {
        name: conn.accountUsername ?? conn.displayName ?? conn.accountExternalId,
        value: connViews || 1,
        color: colors[i % colors.length],
      };
    });
  }

  const total = data.reduce((s, d) => s + d.value, 0);
  const platformLabel = getPlatformLabel(platform);

  return (
    <div className="p-4">
      <div className="mb-4 text-sm text-muted-foreground">Views por Cuenta - {platformLabel}</div>

      <div className="flex items-center gap-6">
        <div className="relative" style={{ width: 140, height: 140 }}>
          <PieChart width={140} height={140}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={65}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              allowEscapeViewBox={{ x: true, y: true }}
              offset={16}
              wrapperStyle={{ zIndex: 20, pointerEvents: "none" }}
              content={({ active, payload }) => {
                if (active && payload?.length) {
                  return (
                    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
                      <p className="text-sm font-medium text-foreground">
                        {payload[0].name}: {formatCompactNumber(payload[0].value as number)}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-semibold text-foreground">
              {formatCompactNumber(totalViews || total)}
            </span>
            <span className="text-label text-muted-foreground">total views</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="max-w-[120px] truncate text-sm text-muted-foreground">{item.name}</span>
              <span className="text-sm font-medium text-foreground">
                {formatCompactNumber(item.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
