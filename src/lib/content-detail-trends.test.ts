import { describe, expect, it } from "vitest";
import { buildContentDetailTrendPoints } from "@/lib/content-detail-trends";

describe("content detail trends", () => {
  it("convierte snapshots acumulados en deltas diarios para views y comentarios", () => {
    const points = buildContentDetailTrendPoints([
      {
        capturedAt: "2026-04-01T09:00:00.000Z",
        metrics: {
          views: 100,
          comments: 8,
        },
      },
      {
        capturedAt: "2026-04-01T19:00:00.000Z",
        metrics: {
          views: 145,
          comments: 11,
        },
      },
      {
        capturedAt: "2026-04-02T20:00:00.000Z",
        metrics: {
          views: 240,
          comments: 17,
        },
      },
      {
        capturedAt: "2026-04-03T20:00:00.000Z",
        metrics: {
          viewCount: 230,
          comment_count: 15,
        },
      },
      {
        capturedAt: "2026-04-04T20:00:00.000Z",
        metrics: {
          viewCount: 320,
          comment_count: 24,
        },
      },
    ]);

    expect(points).toEqual([
      {
        capturedAt: "2026-04-01T19:00:00.000Z",
        label: "01/04",
        views: 45,
        comments: 3,
      },
      {
        capturedAt: "2026-04-02T20:00:00.000Z",
        label: "02/04",
        views: 95,
        comments: 6,
      },
      {
        capturedAt: "2026-04-03T20:00:00.000Z",
        label: "03/04",
        views: 0,
        comments: 0,
      },
      {
        capturedAt: "2026-04-04T20:00:00.000Z",
        label: "04/04",
        views: 90,
        comments: 9,
      },
    ]);
  });
});
