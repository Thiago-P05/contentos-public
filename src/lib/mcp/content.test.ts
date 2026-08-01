import { describe, expect, it } from "vitest";
import { toSafeContent } from "@/lib/mcp/content";
import type { ContentListItem } from "@/lib/types";

function content(): ContentListItem {
  return {
    id: "content-1",
    platform: "instagram",
    connectionId: "connection-1",
    externalId: "external-1",
    publishedAt: "2026-07-25T00:00:00.000Z",
    title: null,
    description: "Descripcion privada",
    caption: "Caption visible",
    durationSeconds: 42,
    permalink: "https://instagram.com/p/example",
    thumbnailUrl: "https://cdn.example.com/thumbnail.jpg",
    mediaUrl: "https://cdn.example.com/private-video.mp4",
    status: "published",
    analysisStatus: "ready",
    analysisInputText: "Entrada privada",
    transcriptionStatus: "ready",
    transcriptionModel: "model",
    transcriptionError: null,
    transcriptionUpdatedAt: "2026-07-25T00:00:00.000Z",
    rawPayload: { access_token: "must-not-leak" },
    createdAt: "2026-07-25T00:00:00.000Z",
    updatedAt: "2026-07-25T00:00:00.000Z",
    latestMetrics: { views: 1200, likes: 40 },
    latestInsight: null,
  };
}

describe("MCP safe content DTO", () => {
  it("omite payloads, URLs privadas y texto de entrada del analisis", () => {
    const value = toSafeContent(content());
    const serialized = JSON.stringify(value);

    expect(value).toMatchObject({
      id: "content-1",
      metrics: { views: 1200, likes: 40 },
      transcriptionStatus: "ready",
    });
    expect(serialized).not.toContain("access_token");
    expect(serialized).not.toContain("private-video");
    expect(serialized).not.toContain("Entrada privada");
    expect(value.thumbnailUrl).toBeNull();
    expect(serialized).not.toContain("cdn.example.com/thumbnail");
  });

  it("expone la thumbnail publica y las metricas avanzadas de YouTube", () => {
    const value = toSafeContent({
      ...content(),
      platform: "youtube",
      latestMetrics: {
        views: 1200,
        averageViewDurationSeconds: 102,
        averageViewPercentage: 48.5,
        watchTimeMinutes: 2040,
        subscribersGained: 18,
      },
    });

    expect(value).toMatchObject({
      thumbnailUrl: "https://cdn.example.com/thumbnail.jpg",
      metrics: {
        averageViewDurationSeconds: 102,
        averageViewPercentage: 48.5,
        watchTimeMinutes: 2040,
        subscribersGained: 18,
      },
    });
  });
});
