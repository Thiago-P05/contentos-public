import { describe, expect, it } from "vitest";
import { getContentKind, isInstagramReelEligibleForTranscript } from "@/lib/content-media";

describe("content media helpers", () => {
  it("detecta reels de instagram con media", () => {
    expect(
      isInstagramReelEligibleForTranscript({
        platform: "instagram",
        mediaUrl: "https://example.com/reel.mp4",
        rawPayload: { media_product_type: "REELS", media_type: "VIDEO" },
      }),
    ).toBe(true);
  });

  it("excluye carruseles, stories, tiktok y reels sin media", () => {
    expect(
      isInstagramReelEligibleForTranscript({
        platform: "instagram",
        mediaUrl: null,
        rawPayload: { media_product_type: "REELS", media_type: "VIDEO" },
      }),
    ).toBe(false);
    expect(
      isInstagramReelEligibleForTranscript({
        platform: "instagram",
        mediaUrl: "https://example.com/story.mp4",
        rawPayload: { media_product_type: "STORY", media_type: "VIDEO" },
      }),
    ).toBe(false);
    expect(
      isInstagramReelEligibleForTranscript({
        platform: "instagram",
        mediaUrl: "https://example.com/carousel.mp4",
        rawPayload: { media_type: "CAROUSEL_ALBUM" },
      }),
    ).toBe(false);
    expect(
      isInstagramReelEligibleForTranscript({
        platform: "tiktok",
        mediaUrl: "https://example.com/tiktok.mp4",
        rawPayload: {},
      }),
    ).toBe(false);
  });

  it("clasifica los photo posts de TikTok como carruseles", () => {
    expect(getContentKind("tiktok", { media_type: 2 })).toBe("Carrusel");
    expect(getContentKind("tiktok", { media_type: "IMAGE_POST" })).toBe("Carrusel");
    expect(getContentKind("tiktok", { media_type: 1 })).toBe("Video");
  });
});
