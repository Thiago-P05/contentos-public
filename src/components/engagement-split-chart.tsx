"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCompactNumber } from "@/lib/format";
import type { DashboardTrendMetricKey, Platform } from "@/lib/types";

type Props = {
  performanceTotals: Record<DashboardTrendMetricKey, number | null>;
  platform: Platform;
};

const INSTAGRAM_SLICES = [
  { key: "likes" as DashboardTrendMetricKey, label: "Likes", color: "var(--series-likes)" },
  { key: "comments" as DashboardTrendMetricKey, label: "Comentarios", color: "var(--series-comments)" },
  { key: "saves" as DashboardTrendMetricKey, label: "Guardados", color: "var(--series-saves)" },
  { key: "shares" as DashboardTrendMetricKey, label: "Compartidos", color: "var(--series-shares)" },
];

const TIKTOK_SLICES = [
  { key: "likes" as DashboardTrendMetricKey, label: "Likes", color: "var(--series-likes)" },
  { key: "comments" as DashboardTrendMetricKey, label: "Comentarios", color: "var(--series-comments)" },
  { key: "shares" as DashboardTrendMetricKey, label: "Compartidos", color: "var(--series-shares)" },
];

export function EngagementSplitChart({ performanceTotals, platform }: Props) {
  const slices = platform === "instagram" ? INSTAGRAM_SLICES : TIKTOK_SLICES;

  const data = slices
    .map((s) => ({
      ...s,
      value: performanceTotals[s.key] ?? 0,
    }))
    .filter((d) => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div className="p-4">
        <div className="mb-4 text-sm text-muted-foreground">Desglose interacciones</div>
        <div className="flex h-[120px] items-center justify-center">
          <p className="text-xs text-muted-foreground">Sin datos de interacciones.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4 text-sm text-muted-foreground">Desglose interacciones</div>

      <div className="flex items-center gap-6">
        <div className="relative size-[120px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={38}
                outerRadius={55}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
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
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-lg font-semibold text-foreground">
              {formatCompactNumber(total)}
            </span>
            <span className="text-label text-muted-foreground">total</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {data.map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <div className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className="text-xs font-medium text-foreground">
                {formatCompactNumber(item.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
