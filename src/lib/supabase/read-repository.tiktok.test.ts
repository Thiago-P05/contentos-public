import { describe, expect, it } from "vitest";
import { buildTikTokSnapshotPerformanceInputs } from "@/lib/supabase/read-repository";
import type { ContentListItem } from "@/lib/types";
import type { SnapshotRow } from "@/lib/supabase/types";

const catalog: ContentListItem[] = [
  {
    id: "content-1",
    platform: "tiktok",
    connectionId: "connection-1",
    externalId: "video-1",
    publishedAt: "2026-01-01T00:00:00.000Z",
    title: null,
    description: null,
    caption: null,
    durationSeconds: null,
    permalink: null,
    thumbnailUrl: null,
    mediaUrl: null,
    status: "published",
    analysisStatus: "pending",
    analysisInputText: null,
    transcriptionStatus: "not_applicable",
    transcriptionModel: null,
    transcriptionError: null,
    transcriptionUpdatedAt: null,
    rawPayload: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    latestMetrics: {},
    latestInsight: null,
  },
];

function snapshot(capturedAt: string, metrics: Record<string, number | null>): SnapshotRow {
  return {
    id: capturedAt,
    content_item_id: "content-1",
    source_platform: "tiktok",
    captured_at: capturedAt,
    metrics,
    raw_payload: {},
    created_at: capturedAt,
  };
}

describe("TikTok dashboard snapshots", () => {
  it("atribuye solo el delta al dia de captura, no al de publicacion", () => {
    const inputs = buildTikTokSnapshotPerformanceInputs(
      [
        snapshot("2026-01-02T10:00:00.000Z", { views: 100, likes: 10 }),
        snapshot("2026-01-04T10:00:00.000Z", { views: 145, likes: 16 }),
      ],
      catalog,
    );

    expect(inputs).toEqual([
      {
        insightDate: "2026-01-04",
        platform: "tiktok",
        connectionId: "connection-1",
        metrics: { views: 45, likes: 6 },
      },
    ]);
  });
});
