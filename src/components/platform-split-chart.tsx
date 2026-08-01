"use client";

import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { formatCompactNumber } from "@/lib/format";
import type { DashboardTrendMetricKey, Platform } from "@/lib/types";
import { getPlatformColor, PLATFORM_LABELS } from "@/lib/platforms";

type Props = {
  performanceTotals: Record<DashboardTrendMetricKey, number | null>;
  platform: Platform;
  platformBreakdown: Array<{ platform: Platform; count: number }>;
};

type SliceItem = { name: string; value: number; color: string };

export function PlatformSplitChart({ performanceTotals, platform, platformBreakdown }: Props) {
  const totalViews = performanceTotals.views ?? 0;

  const hasBothPlatforms = platformBreakdown.length > 1;
  const totalCount = platformBreakdown.reduce((s, b) => s + b.count, 0) || 1;

  let displayData: SliceItem[];

  if (hasBothPlatforms) {
    const rawData = platformBreakdown.map((b) => ({
      name: PLATFORM_LABELS[b.platform] ?? b.platform,
      value: Math.round((b.count / totalCount) * totalViews),
      color: getPlatformColor(b.platform),
    }));
    const hasAnyValue = rawData.some((d) => d.value > 0);
    displayData = hasAnyValue
      ? rawData.filter((d) => d.value > 0)
      : platformBreakdown.map((b) => ({
          name: PLATFORM_LABELS[b.platform] ?? b.platform,
          value: b.count || 1,
          color: getPlatformColor(b.platform),
        }));
  } else {
    displayData = [{
      name: PLATFORM_LABELS[platform],
      value: totalViews || 1,
      color: getPlatformColor(platform),
    }];
  }

  const total = displayData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="border-r border-border p-4">
      <div className="mb-4 text-sm text-muted-foreground">Views por Red Social</div>

      <div className="flex items-center gap-6">
        <div className="relative" style={{ width: 140, height: 140 }}>
          <PieChart width={140} height={140}>
            <Pie
              data={displayData}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={65}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {displayData.map((entry: SliceItem, index: number) => (
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
              {formatCompactNumber(total)}
            </span>
            <span className="text-label text-muted-foreground">total views</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {displayData.map((item: SliceItem) => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="text-sm text-muted-foreground">{item.name}</span>
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
