import {
  buildAnalysisPlan,
  buildMetadataFallbackText,
  chooseAnalysisInput,
  getInsightPromptProfile,
} from "@/lib/ai/analysis";
import { buildOutputContract } from "@/lib/ai/prompts/contract";
import { getDefaultPlatformConnectionBriefFields } from "@/lib/connection-briefs";
import type { ContentItem, TextAsset } from "@/lib/types";
import { describe, expect, it } from "vitest";

const brief = getDefaultPlatformConnectionBriefFields();

const baseItem: ContentItem = {
  id: "1",
  platform: "instagram",
  connectionId: null,
  externalId: "abc",
  publishedAt: "2025-12-10T12:00:00.000Z",
  title: "Como estructurar un reel",
  description: "Descripcion larga",
  caption: null,
  durationSeconds: 62,
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
  createdAt: "2025-12-10T12:00:00.000Z",
  updatedAt: "2025-12-10T12:00:00.000Z",
};

describe("analysis helpers", () => {
  it("combina caption y transcript cuando ambos existen", () => {
    const assets: TextAsset[] = [
      {
        id: "a",
        contentItemId: "1",
        sourceType: "transcript",
        content: "Transcript disponible",
        language: "es",
        rawPayload: {},
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "b",
        contentItemId: "1",
        sourceType: "official_caption",
        content: "Caption oficial",
        language: "es",
        rawPayload: {},
        createdAt: "",
        updatedAt: "",
      },
    ];

    const result = chooseAnalysisInput(baseItem, assets);

    expect(result.sourceType).toBe("transcript");
    expect(result.content).toContain("Caption oficial");
    expect(result.content).toContain("Transcript disponible");
  });

  it("arma metadata fallback sin metricas", () => {
    const result = buildMetadataFallbackText(baseItem);

    expect(result).toContain("Plataforma: instagram");
    expect(result).not.toContain("Views:");
    expect(result).not.toContain("Likes:");
  });

  it("usa prompt de historia para stories de instagram", () => {
    expect(
      getInsightPromptProfile({
        ...baseItem,
        platform: "instagram",
        rawPayload: { media_product_type: "STORY" },
      }),
    ).toBe("instagram_story");
  });

  it("usa short_video para reels", () => {
    expect(
      getInsightPromptProfile({
        ...baseItem,
        platform: "instagram",
        mediaUrl: "https://example.com/reel.mp4",
        rawPayload: { media_product_type: "REELS", media_type: "VIDEO" },
      }),
    ).toBe("short_video");
  });

  it("usa carousel para carruseles", () => {
    expect(
      getInsightPromptProfile({
        ...baseItem,
        platform: "instagram",
        rawPayload: { media_type: "CAROUSEL_ALBUM" },
      }),
    ).toBe("carousel");
  });

  it("usa long_video para YouTube", () => {
    expect(
      getInsightPromptProfile({
        ...baseItem,
        platform: "youtube",
      }),
    ).toBe("long_video");
  });

  it("usa multimodal_video para reels de instagram sin transcript", () => {
    const plan = buildAnalysisPlan(
      {
        ...baseItem,
        platform: "instagram",
        mediaUrl: "https://example.com/reel.mp4",
        rawPayload: { media_product_type: "REELS", media_type: "VIDEO" },
      },
      { sourceType: "official_caption", content: "Texto base" },
      brief,
    );

    expect(plan.evidenceMode).toBe("multimodal_video");
    expect(plan.prompt).not.toContain("Metricas:");
  });

  it("prefiere text/transcript sobre multimodal_video cuando hay transcript listo", () => {
    const plan = buildAnalysisPlan(
      {
        ...baseItem,
        platform: "instagram",
        mediaUrl: "https://example.com/reel.mp4",
        thumbnailUrl: "https://example.com/cover.jpg",
        rawPayload: { media_product_type: "REELS", media_type: "VIDEO" },
      },
      { sourceType: "transcript", content: "Caption:\nHola\n\nTranscripcion:\nHola mundo" },
      brief,
    );

    expect(plan.evidenceMode).toBe("text_plus_cover");
    expect(plan.remoteAssets).toEqual([
      { label: "Portada", url: "https://example.com/cover.jpg" },
    ]);
  });

  it("usa text_only con transcript sin portada (no reenvia video)", () => {
    const plan = buildAnalysisPlan(
      {
        ...baseItem,
        platform: "instagram",
        mediaUrl: "https://example.com/reel.mp4",
        thumbnailUrl: null,
        rawPayload: { media_product_type: "REELS", media_type: "VIDEO" },
      },
      { sourceType: "transcript", content: "Transcripcion del reel" },
      brief,
    );

    expect(plan.evidenceMode).toBe("text_only");
    expect(plan.remoteAssets).toEqual([]);
  });

  it("no incluye videoPotential en el contrato del modelo", () => {
    const contract = buildOutputContract();

    expect(contract).not.toContain("videoPotential");
  });

  it("usa text_plus_cover para tiktok sin video remoto", () => {
    const plan = buildAnalysisPlan(
      {
        ...baseItem,
        platform: "tiktok",
        thumbnailUrl: "https://example.com/cover.jpg",
      },
      { sourceType: "metadata_fallback", content: "Texto base" },
      brief,
    );

    expect(plan.evidenceMode).toBe("text_plus_cover");
  });

  it("usa portada como evidencia para YouTube", () => {
    const plan = buildAnalysisPlan(
      {
        ...baseItem,
        platform: "youtube",
        thumbnailUrl: "https://example.com/youtube-cover.jpg",
      },
      { sourceType: "official_caption", content: "Texto base" },
      brief,
    );

    expect(plan.promptProfile).toBe("long_video");
    expect(plan.evidenceMode).toBe("text_plus_cover");
  });
});
