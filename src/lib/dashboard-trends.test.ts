import { describe, expect, it } from "vitest";
import { buildDashboardPerformance } from "@/lib/dashboard-trends";

describe("dashboard trends", () => {
  it("mantiene buckets completos del rango aunque falten observaciones", () => {
    const performance = buildDashboardPerformance(
      [
        {
          contentItemId: "content-1",
          sourcePlatform: "tiktok",
          capturedAt: "2026-03-07T15:00:00.000Z",
          metrics: { views: 10 },
        },
        {
          contentItemId: "content-1",
          sourcePlatform: "tiktok",
          capturedAt: "2026-03-09T15:00:00.000Z",
          metrics: { views: 30 },
        },
        {
          contentItemId: "content-1",
          sourcePlatform: "tiktok",
          capturedAt: "2026-03-11T15:00:00.000Z",
          metrics: { views: 50 },
        },
      ],
      "week",
      "2026-03-12",
      new Date("2026-03-12T18:00:00.000Z"),
    );

    expect(performance.series).toHaveLength(4);
    expect(performance.series.map((point) => point.label)).toEqual([
      "09/03",
      "10/03",
      "11/03",
      "12/03",
    ]);

    const day09 = performance.series.find((point) => point.label === "09/03");
    const day10 = performance.series.find((point) => point.label === "10/03");
    const day11 = performance.series.find((point) => point.label === "11/03");
    const day12 = performance.series.find((point) => point.label === "12/03");

    expect(day09?.metrics.views).toBe(20);
    expect(day09?.observedMetrics).toContain("views");
    expect(day10?.metrics.views).toBe(0);
    expect(day10?.observedMetrics).not.toContain("views");
    expect(day11?.metrics.views).toBe(20);
    expect(day11?.observedMetrics).toContain("views");
    expect(day12?.metrics.views).toBe(0);
    expect(day12?.observedMetrics).not.toContain("views");
    expect(performance.series.every((point) => point.isPending === false)).toBe(true);
  });

  it("marca los ultimos 2 dias de Instagram como pendientes y suma solo tramo consolidado", () => {
    const performance = buildDashboardPerformance(
      [
        {
          contentItemId: "content-1",
          sourcePlatform: "instagram",
          capturedAt: "2026-03-06T15:00:00.000Z",
          metrics: { views: 100 },
        },
        {
          contentItemId: "content-1",
          sourcePlatform: "instagram",
          capturedAt: "2026-03-07T15:00:00.000Z",
          metrics: { views: 130 },
        },
        {
          contentItemId: "content-1",
          sourcePlatform: "instagram",
          capturedAt: "2026-03-08T15:00:00.000Z",
          metrics: { views: 150 },
        },
        {
          contentItemId: "content-1",
          sourcePlatform: "instagram",
          capturedAt: "2026-03-09T15:00:00.000Z",
          metrics: { views: 170 },
        },
        {
          contentItemId: "content-1",
          sourcePlatform: "instagram",
          capturedAt: "2026-03-10T15:00:00.000Z",
          metrics: { views: 190 },
        },
      ],
      "month",
      "2026-03-10",
      new Date("2026-03-10T18:00:00.000Z"),
    );

    expect(performance.series).toHaveLength(10);
    expect(performance.availability.status).toBe("partial");
    expect(performance.availability.message).toContain("48 h");

    const day07 = performance.series.find((point) => point.label === "07/03");
    const day08 = performance.series.find((point) => point.label === "08/03");
    const day09 = performance.series.find((point) => point.label === "09/03");
    const day10 = performance.series.find((point) => point.label === "10/03");

    expect(day07?.isPending).toBe(false);
    expect(day07?.metrics.views).toBe(30);
    expect(day07?.observedMetrics).toContain("views");
    expect(day08?.isPending).toBe(true);
    expect(day08?.metrics.views).toBe(20);
    expect(day08?.observedMetrics).toContain("views");
    expect(day09?.isPending).toBe(true);
    expect(day10?.isPending).toBe(true);
    expect(day10?.observedMetrics).not.toContain("views");
    expect(performance.totals.totalViews).toBe(150);
  });

  it("devuelve serie pendiente cuando todavia no hay datos consolidados", () => {
    const performance = buildDashboardPerformance(
      [
        {
          contentItemId: "content-1",
          sourcePlatform: "instagram",
          capturedAt: "2026-03-09T15:00:00.000Z",
          metrics: { views: 100 },
        },
        {
          contentItemId: "content-1",
          sourcePlatform: "instagram",
          capturedAt: "2026-03-10T15:00:00.000Z",
          metrics: { views: 120 },
        },
      ],
      "month",
      "2026-03-10",
      new Date("2026-03-10T18:00:00.000Z"),
    );

    expect(performance.series).toHaveLength(10);
    expect(performance.availability.status).toBe("partial");
    expect(performance.availability.message).toContain("48 h");
    expect(performance.totals.totalViews).toBeNull();
  });

  it("en rango year no desplaza enero al mes anterior", () => {
    const performance = buildDashboardPerformance(
      [
        {
          contentItemId: "content-1",
          sourcePlatform: "tiktok",
          capturedAt: "2026-01-15T12:00:00.000Z",
          metrics: { views: 100 },
        },
        {
          contentItemId: "content-1",
          sourcePlatform: "tiktok",
          capturedAt: "2026-03-15T12:00:00.000Z",
          metrics: { views: 220 },
        },
      ],
      "year",
      "2026-03-31",
      new Date("2026-03-31T18:00:00.000Z"),
    );

    expect(performance.series.map((point) => point.label)).toEqual([
      "ene 26",
      "feb 26",
      "mar 26",
    ]);

    const march = performance.series.find((point) => point.label === "mar 26");

    expect(march?.metrics.views).toBe(120);
    expect(march?.observedMetrics).toContain("views");
  });

  it("usa primera y ultima observacion del bucket si no hay baseline previo", () => {
    const performance = buildDashboardPerformance(
      [
        {
          contentItemId: "content-1",
          sourcePlatform: "instagram",
          capturedAt: "2026-03-27T08:00:00.000Z",
          metrics: { views: 100 },
        },
        {
          contentItemId: "content-1",
          sourcePlatform: "instagram",
          capturedAt: "2026-03-28T09:00:00.000Z",
          metrics: { views: 487 },
        },
      ],
      "year",
      "2026-03-31",
      new Date("2026-03-31T18:00:00.000Z"),
    );

    const march = performance.series.find((point) => point.label === "mar 26");

    expect(march?.isPending).toBe(true);
    expect(march?.metrics.views).toBe(387);
    expect(march?.observedMetrics).toContain("views");
  });

  it("no infla deltas cuando la baseline no trae la metrica", () => {
    const performance = buildDashboardPerformance(
      [
        {
          contentItemId: "content-1",
          sourcePlatform: "instagram",
          capturedAt: "2026-03-26T09:00:00.000Z",
          metrics: {},
        },
        {
          contentItemId: "content-1",
          sourcePlatform: "instagram",
          capturedAt: "2026-03-30T09:00:00.000Z",
          metrics: { views: 340000 },
        },
      ],
      "year",
      "2026-03-31",
      new Date("2026-03-31T18:00:00.000Z"),
    );

    const march = performance.series.find((point) => point.label === "mar 26");

    expect(march?.metrics.views).toBe(0);
    expect(march?.observedMetrics).not.toContain("views");
  });
});
