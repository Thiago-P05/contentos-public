"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { SegmentedSelector } from "@/components/segmented-selector";
import { DashboardSectionCards } from "@/components/dashboard-section-cards";
import { SyncButton } from "@/components/sync-button";
import { SetupChecklist } from "@/components/setup-checklist";
import { PLATFORM_OPTIONS } from "@/lib/platforms";
import type { DashboardTrendMetricKey, Platform, DashboardOverview, DashboardRange } from "@/lib/types";

function ChartSkeleton({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse bg-surface-elevated/30 ${className}`}
      aria-hidden
    />
  );
}

const MetricAreaChart = dynamic(
  () =>
    import("@/components/metric-area-chart").then((mod) => mod.MetricAreaChart),
  {
    loading: () => (
      <ChartSkeleton className="h-[280px] border-t border-border" />
    ),
  },
);

const PlatformSplitChart = dynamic(
  () =>
    import("@/components/platform-split-chart").then(
      (mod) => mod.PlatformSplitChart,
    ),
  {
    loading: () => <ChartSkeleton className="h-[200px]" />,
  },
);

const FollowersSparklineCard = dynamic(
  () =>
    import("@/components/followers-sparkline-card").then(
      (mod) => mod.FollowersSparklineCard,
    ),
  {
    loading: () => <ChartSkeleton className="h-[200px]" />,
  },
);

const AccountViewsChart = dynamic(
  () =>
    import("@/components/account-views-chart").then(
      (mod) => mod.AccountViewsChart,
    ),
  {
    loading: () => <ChartSkeleton className="h-[200px]" />,
  },
);

const ContentDataTable = dynamic(
  () =>
    import("@/components/content-data-table").then(
      (mod) => mod.ContentDataTable,
    ),
  {
    loading: () => (
      <ChartSkeleton className="h-[320px] border-t border-border" />
    ),
  },
);

type StatCard = {
  key: DashboardTrendMetricKey;
  label: string;
  value: string;
  hint?: string;
  comparison: { value: number; label?: string } | null;
};

type Props = {
  overview: DashboardOverview;
  cards: StatCard[];
  activePlatform: Platform;
  selectedRange: DashboardRange;
  activeAnchor: string | null;
  currentDataAnchor: string | null;
};

const PERIOD_OPTIONS: { label: string; value: DashboardRange }[] = [
  { label: "30 Dias", value: "last30" },
  { label: "60 Dias", value: "last60" },
  { label: "90 Dias", value: "last90" },
];

function buildDashboardHref({
  range,
  platform,
  connectionId,
}: {
  range: string;
  platform: string;
  connectionId?: string | null;
}) {
  const params = new URLSearchParams();
  if (range !== "all") params.set("range", range);
  params.set("platform", platform);
  if (platform !== "all" && connectionId) {
    params.set("connection", connectionId);
  }
  const query = params.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}

export function DashboardClient({
  overview,
  cards,
  activePlatform,
  selectedRange,
  activeAnchor: _activeAnchor,
  currentDataAnchor: _currentDataAnchor,
}: Props) {
  const defaultMetric: DashboardTrendMetricKey = cards[0]?.key ?? "views";
  const [selectedMetric, setSelectedMetric] = useState<DashboardTrendMetricKey>(defaultMetric);

  const hasSetupIssues = overview.missingEnv.length > 0 || overview.setupIssues.length > 0;

  const platformOptions = PLATFORM_OPTIONS.filter((o) => o.value !== "all").map((o) => ({
    label: o.label,
    value: o.value,
  }));

  // Account options for the active platform — only shown when multiple connections exist
  const platformConnections = overview.availableConnections.filter(
    (c) => c.platform === activePlatform,
  );
  const accountOptions: { label: string; value: string }[] =
    platformConnections.length > 1
      ? [
          { label: "Todas", value: "all" },
          ...platformConnections.map((c) => ({
            label: c.accountUsername ?? c.displayName ?? c.accountExternalId,
            value: c.id,
          })),
        ]
      : [];

  const activeConnectionId = overview.selectedConnectionId ?? "all";

  return (
    <div className="flex w-full flex-col gap-0">
      {hasSetupIssues ? (
        <div className="mb-4">
          <SetupChecklist
            missingEnv={overview.missingEnv}
            setupIssues={overview.setupIssues}
          />
        </div>
      ) : null}

      {/* ── Filter bar ── */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* Platform selector */}
          <SegmentedSelector
            options={platformOptions}
            active={
              overview.selectedPlatform === "all" ? activePlatform : overview.selectedPlatform
            }
            buildHref={(value) =>
              buildDashboardHref({ range: selectedRange, platform: value, connectionId: null })
            }
          />

          {/* Account selector — only when multiple connections */}
          {accountOptions.length > 0 ? (
            <SegmentedSelector
              options={accountOptions}
              active={activeConnectionId}
              buildHref={(value) =>
                buildDashboardHref({
                  range: selectedRange,
                  platform: activePlatform,
                  connectionId: value,
                })
              }
            />
          ) : null}

          {/* Period selector — 30 / 60 / 90 dias */}
          <SegmentedSelector
            options={PERIOD_OPTIONS}
            active={selectedRange}
            buildHref={(value) =>
              buildDashboardHref({
                range: value,
                platform: activePlatform,
                connectionId: activeConnectionId,
              })
            }
          />
        </div>

        {/* Right: Sync */}
        <div className="flex shrink-0 items-center [&_button]:shadow-float">
          <SyncButton
            enabled={overview.configured}
            platform={activePlatform}
            connectionId={overview.selectedConnectionId}
            label="Sync"
          />
        </div>
      </div>

      {/* ── Stitched slab: stat cards, chart, secondary charts and table share
             their edges, so the radius belongs to the outer silhouette. ── */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-float">
        {/* 8 stat cards, interactive */}
        <DashboardSectionCards
          cards={cards}
          selectedMetric={selectedMetric}
          onMetricChange={setSelectedMetric}
        />

        {/* Area chart */}
        <MetricAreaChart
          metric={selectedMetric}
          points={overview.performanceSeries}
          platform={activePlatform}
        />

        {/* Secondary charts row */}
        <div className="grid grid-cols-1 border-t border-border md:grid-cols-3">
          <PlatformSplitChart
            performanceTotals={overview.performanceTotals}
            platform={activePlatform}
            platformBreakdown={overview.platformBreakdown}
          />
          <FollowersSparklineCard
            follows={overview.performanceTotals.follows}
            previousFollows={overview.previousPeriodTotals.follows}
            series={overview.performanceSeries}
          />
          <AccountViewsChart
            performanceTotals={overview.performanceTotals}
            platform={activePlatform}
            availableConnections={overview.availableConnections}
            selectedConnectionId={overview.selectedConnectionId}
            connectionViewTotals={overview.connectionViewTotals}
          />
        </div>

        {/* Posts table */}
        <ContentDataTable items={overview.topContent} />
      </div>
    </div>
  );
}
