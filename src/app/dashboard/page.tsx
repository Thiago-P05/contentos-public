import {
  normalizeDashboardAnchor,
  normalizeDashboardRange,
} from "@/lib/dashboard-range";
import {
  formatDashboardMetricValue,
  getDashboardMetricDefinition,
} from "@/lib/dashboard-metrics";
import { requireAllowedPageUser } from "@/lib/server-auth";
import { getDashboardOverview } from "@/lib/supabase/repository";
import type { DashboardTrendMetricKey, Platform } from "@/lib/types";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    range?: string;
    platform?: string;
    connection?: string;
    anchor?: string;
  }>;
};

const TOP_METRICS: Record<
  Platform,
  Array<{ key: DashboardTrendMetricKey; label: string; hint: string }>
> = {
  instagram: [
    { key: "views", label: "Views", hint: "acumulado" },
    { key: "reach", label: "Alcance", hint: "acumulado" },
    { key: "contentInteractions", label: "Interacciones", hint: "acumulado" },
    { key: "profileVisits", label: "Visitas Perfil", hint: "acumulado" },
    { key: "engagementRate", label: "Engagement", hint: "del periodo" },
    { key: "profileCtr", label: "CTR Perfil", hint: "% del alcance" },
    { key: "linkClicks", label: "Link Clicks", hint: "acumulado" },
  ],
  tiktok: [
    { key: "views", label: "Views", hint: "acumulado" },
    { key: "likes", label: "Likes", hint: "acumulado" },
    { key: "shares", label: "Compartidos", hint: "acumulado" },
    { key: "engagementRate", label: "Engagement", hint: "del periodo" },
    { key: "likeRate", label: "Like Rate", hint: "del periodo" },
    { key: "shareRate", label: "Share Rate", hint: "del periodo" },
    { key: "saves", label: "Guardados", hint: "acumulado" },
  ],
  youtube: [
    { key: "views", label: "Views", hint: "acumulado" },
    { key: "watchTimeMinutes", label: "Tiempo visto", hint: "del periodo" },
    { key: "averageViewDurationSeconds", label: "Duracion media", hint: "del periodo" },
    { key: "subscribersGained", label: "Suscriptores ganados", hint: "del periodo" },
    { key: "subscribersLost", label: "Suscriptores perdidos", hint: "del periodo" },
    { key: "likes", label: "Likes", hint: "acumulado" },
    { key: "comments", label: "Comentarios", hint: "acumulado" },
  ],
};


export default async function DashboardPage({ searchParams }: PageProps) {
  await requireAllowedPageUser();

  const params = await searchParams;
  const selectedRange = normalizeDashboardRange(params.range);
  const selectedPlatform =
    params.platform === "instagram" || params.platform === "tiktok" || params.platform === "youtube"
      ? params.platform
      : "instagram";
  const selectedAnchor = normalizeDashboardAnchor(params.anchor);

  const overview = await getDashboardOverview(
    selectedRange,
    selectedPlatform,
    params.connection ?? null,
    selectedAnchor,
  );

  const activeAnchor = overview.selectedAnchor ?? selectedAnchor;
  const currentDataAnchor = overview.latestDataAnchor ?? activeAnchor;
  const activePlatform = (
    overview.selectedPlatform === "all" ? "instagram" : overview.selectedPlatform
  ) as Platform;

  const cards = TOP_METRICS[activePlatform].map((card) => {
    const current = overview.performanceTotals[card.key];
    let comparison: { value: number; label?: string } | null = null;

    const isMonthMetric =
      card.key === "follows" ||
      card.key === "engagementRate" ||
      card.key === "profileCtr" ||
      card.key === "followConversion" ||
      card.key === "likeRate" ||
      card.key === "shareRate";

    if (isMonthMetric) {
      const previousMonth = overview.previousMonthTotals[card.key];
      if (typeof current === "number" && Number.isFinite(current) && current !== 0) {
        if (typeof previousMonth === "number" && Number.isFinite(previousMonth)) {
          comparison = {
            value: previousMonth === 0 ? 100 : ((current - previousMonth) / previousMonth) * 100,
            label: "vs. mes ant.",
          };
        }
      }
    } else {
      const previous = overview.previousPeriodTotals[card.key];
      if (typeof current === "number" && Number.isFinite(current) && current !== 0) {
        if (typeof previous === "number" && Number.isFinite(previous)) {
          comparison = {
            value: previous === 0 ? 100 : ((current - previous) / previous) * 100,
            label: "vs. periodo ant.",
          };
        }
      }
    }

    return {
      key: card.key,
      label: card.label,
      hint: card.hint,
      value: formatDashboardMetricValue(card.key, current),
      accentColor: getDashboardMetricDefinition(card.key).color,
      comparison,
    };
  });

  return (
    <DashboardClient
      overview={overview}
      cards={cards}
      activePlatform={activePlatform}
      selectedRange={selectedRange}
      activeAnchor={activeAnchor}
      currentDataAnchor={currentDataAnchor}
    />
  );
}
