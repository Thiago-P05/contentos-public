import { describe, expect, it } from "vitest";
import {
  InvalidCompetitionProfileUrlError,
  normalizeInstagramProfileUrl,
} from "@/lib/competition/url";

describe("competition url normalization", () => {
  it("accepts instagram profile urls with or without protocol", () => {
    expect(normalizeInstagramProfileUrl("instagram.com/mi.usuario")).toEqual({
      username: "mi.usuario",
      normalizedUrl: "https://www.instagram.com/mi.usuario/",
    });

    expect(
      normalizeInstagramProfileUrl("https://www.instagram.com/otro_usuario/?hl=es"),
    ).toEqual({
      username: "otro_usuario",
      normalizedUrl: "https://www.instagram.com/otro_usuario/",
    });
  });

  it("rejects reels and non-instagram hosts", () => {
    expect(() => normalizeInstagramProfileUrl("https://www.instagram.com/reel/ABC123/")).toThrow(
      InvalidCompetitionProfileUrlError,
    );
    expect(() => normalizeInstagramProfileUrl("https://example.com/usuario/")).toThrow(
      InvalidCompetitionProfileUrlError,
    );
  });
});
