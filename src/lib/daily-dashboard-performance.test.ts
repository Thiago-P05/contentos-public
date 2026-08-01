import { describe, expect, it } from "vitest";
import { buildDashboardPerformanceFromDailyInsights } from "@/lib/daily-dashboard-performance";

describe("daily dashboard performance", () => {
  it("marca como pendientes los ultimos dias de Instagram aunque falten filas", () => {
    const performance = buildDashboardPerformanceFromDailyInsights(
      [
        { insightDate: "2026-04-01", platform: "instagram", connectionId: "connection-1", metrics: { views: 438 } },
        { insightDate: "2026-04-02", platform: "instagram", connectionId: "connection-1", metrics: { views: 835 } },
        { insightDate: "2026-04-03", platform: "instagram", connectionId: "connection-1", metrics: { views: 58 } },
      ],
      "month",
      "2026-04-05",
      new Date("2026-04-05T15:00:00.000Z"),
    );

    expect(performance.series).toHaveLength(5);
    expect(performance.availability.status).toBe("partial");
    expect(performance.availability.message).toContain("48 h");

    const day03 = performance.series.find((point) => point.label === "03/04");
    const day04 = performance.series.find((point) => point.label === "04/04");
    const day05 = performance.series.find((point) => point.label === "05/04");

    expect(day03?.isPending).toBe(true);
    expect(day03?.hasObservedData).toBe(true);
    expect(day04?.isPending).toBe(true);
    expect(day04?.hasObservedData).toBe(false);
    expect(day05?.isPending).toBe(true);
    expect(day05?.hasObservedData).toBe(false);
  });
});
