import { describe, expect, it } from "vitest";
import { getYouTubeEmbedUrl } from "@/lib/youtube-embed";

describe("getYouTubeEmbedUrl", () => {
  it("crea un embed privacy-enhanced para un video ID valido", () => {
    expect(getYouTubeEmbedUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&modestbranding=1&rel=0",
    );
  });

  it("rechaza IDs que no pueden usarse en una URL de embed", () => {
    expect(getYouTubeEmbedUrl("javascript:alert(1)")).toBeNull();
  });
});
