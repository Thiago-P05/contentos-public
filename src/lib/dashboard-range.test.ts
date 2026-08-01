import { describe, expect, it } from "vitest";
import {
  buildDashboardPerformanceSeries,
  filterItemsByDashboardRange,
  normalizeDashboardRange,
} from "@/lib/dashboard-range";

describe("dashboard range helpers", () => {
  it("normaliza valores invalidos a last30", () => {
    expect(normalizeDashboardRange("month")).toBe("month");
    expect(normalizeDashboardRange("cualquier-cosa")).toBe("last30");
    expect(normalizeDashboardRange(undefined)).toBe("last30");
  });

  it("filtra por mes actual en America/Buenos_Aires", () => {
    const items = [
      { publishedAt: "2026-03-02T14:00:00.000Z" },
      { publishedAt: "2026-02-27T23:30:00.000Z" },
    ];

    const filtered = filterItemsByDashboardRange(
      items,
      "month",
      null,
      new Date("2026-03-26T12:00:00.000Z"),
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.publishedAt).toBe("2026-03-02T14:00:00.000Z");
  });

  it("construye la serie completa del mes con huecos en cero", () => {
    const series = buildDashboardPerformanceSeries(
      [
        { publishedAt: "2026-03-02T14:00:00.000Z", views: 120 },
        { publishedAt: "2026-03-05T15:00:00.000Z", views: 80 },
      ],
      "month",
      new Date("2026-03-05T18:00:00.000Z"),
    );

    expect(series).toHaveLength(5);
    expect(series[0]).toMatchObject({ label: "01/03", views: 0 });
    expect(series[1]).toMatchObject({ label: "02/03", views: 120 });
    expect(series[2]).toMatchObject({ label: "03/03", views: 0 });
    expect(series[3]).toMatchObject({ label: "04/03", views: 0 });
    expect(series[4]).toMatchObject({ label: "05/03", views: 80 });
  });
});
