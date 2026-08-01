import { describe, expect, it } from "vitest";
import {
  buildLibraryViewsSeriesFromPerformance,
  buildLibrarySummary,
  getLibraryItemComments,
  getLibraryItemViews,
} from "@/lib/content-library-metrics";

function buildItem(index: number, metrics: Record<string, number | null>) {
  const base = new Date("2026-01-01T12:00:00.000Z");
  base.setUTCDate(base.getUTCDate() + index);

  return {
    publishedAt: base.toISOString(),
    latestMetrics: metrics,
  };
}

describe("content library metrics", () => {
  it("usa solo los ultimos 60 contenidos por fecha", () => {
    const items = Array.from({ length: 70 }, (_, index) =>
      buildItem(index + 1, { views: index + 1 }),
    );

    const summary = buildLibrarySummary(items, 60);

    expect(summary.latestItems).toHaveLength(60);
    const oldestIncluded = summary.latestItems[summary.latestItems.length - 1]!;
    expect(oldestIncluded.latestMetrics.views).toBe(11);
  });

  it("calcula engagement ponderado sobre vistas totales", () => {
    const summary = buildLibrarySummary(
      [
        buildItem(1, { views: 100, likes: 20, comments: 10, shares: 0, saves: 0 }),
        buildItem(2, { views: 50, likes: 5, comments: 0, shares: 0, saves: 0 }),
      ],
      60,
    );

    expect(summary.totalViews).toBe(150);
    expect(summary.totalInteractions).toBe(35);
    expect(summary.weightedEngagementRate).toBeCloseTo((35 / 150) * 100, 5);
  });

  it("prioriza views sobre reach cuando ambas metricas existen", () => {
    const item = buildItem(1, { views: 70321, reach: 50260 });

    expect(getLibraryItemViews(item)).toBe(70321);
  });

  it("agrega serie de views por fecha en orden ascendente", () => {
    const summary = buildLibrarySummary(
      [
        {
          publishedAt: "2026-04-03T10:00:00.000Z",
          latestMetrics: { viewCount: 25, comment_count: 4 },
        },
        {
          publishedAt: "2026-04-01T10:00:00.000Z",
          latestMetrics: { views: 10, comments: 2 },
        },
        {
          publishedAt: "2026-04-03T22:00:00.000Z",
          latestMetrics: { reach: 5, commentCount: 1 },
        },
      ],
      60,
    );

    expect(summary.viewsSeries.map((entry) => entry.date)).toEqual([
      "2026-04-01",
      "2026-04-03",
    ]);
    expect(summary.viewsSeries.map((entry) => entry.value)).toEqual([10, 30]);

    const firstItem = summary.latestItems[0]!;
    expect(getLibraryItemViews(firstItem)).toBeGreaterThanOrEqual(0);
    expect(getLibraryItemComments(firstItem)).toBeGreaterThanOrEqual(0);
  });

  it("arma la serie de biblioteca desde puntos observados reales", () => {
    const series = buildLibraryViewsSeriesFromPerformance([
      {
        bucketStart: "2026-04-01T00:00:00.000Z",
        observedMetrics: ["views"],
        metrics: { views: 1200 },
      },
      {
        bucketStart: "2026-04-02T00:00:00.000Z",
        observedMetrics: [],
        metrics: { views: 0 },
      },
      {
        bucketStart: "2026-04-03T00:00:00.000Z",
        observedMetrics: ["views"],
        metrics: { views: 1800 },
      },
    ]);

    expect(series).toEqual([
      { date: "2026-04-01", value: 1200 },
      { date: "2026-04-03", value: 1800 },
    ]);
  });
});
