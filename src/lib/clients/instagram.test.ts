import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchInstagramContent } from "@/lib/clients/instagram";

describe("instagram client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("filtra contenido que no sea reels o carruseles y mapea caption", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "reel-1",
              media_product_type: "REELS",
              caption: "Hola",
              timestamp: "2025-12-05T12:00:00+0000",
            },
            {
              id: "post-1",
              media_product_type: "FEED",
              caption: "No deberia entrar",
              timestamp: "2025-12-05T12:00:00+0000",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
        }),
      });

    vi.stubGlobal("fetch", fetchMock);
    process.env.INSTAGRAM_API_BASE_URL = "https://graph.facebook.com";
    process.env.INSTAGRAM_GRAPH_API_VERSION = "v25.0";

    const result = await fetchInstagramContent({
      id: "connection-1",
      platform: "instagram",
      accountExternalId: "user",
      accountUsername: "test",
      displayName: "Test",
      accessToken: "token",
      refreshToken: null,
      tokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      scopes: [],
      status: "active",
      rawProfile: {},
      createdAt: "",
      updatedAt: "",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.externalId).toBe("reel-1");
    expect(result[0]?.connectionId).toBe("connection-1");
    expect(result[0]?.textAssets[0]?.content).toBe("Hola");
  });

  it("pide views para carruseles y no confunde reach con views", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "carousel-1",
              media_product_type: "FEED",
              media_type: "CAROUSEL_ALBUM",
              caption: 'Comenta "Carrusel"',
              timestamp: "2026-03-30T16:57:43+0000",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { name: "views", values: [{ value: 70321 }] },
            { name: "reach", values: [{ value: 50260 }] },
            { name: "likes", values: [{ value: 1944 }] },
            { name: "comments", values: [{ value: 3081 }] },
            { name: "saved", values: [{ value: 2279 }] },
            { name: "total_interactions", values: [{ value: 8843 }] },
          ],
        }),
      });

    vi.stubGlobal("fetch", fetchMock);
    process.env.INSTAGRAM_API_BASE_URL = "https://graph.facebook.com";
    process.env.INSTAGRAM_GRAPH_API_VERSION = "v25.0";

    const result = await fetchInstagramContent({
      id: "connection-1",
      platform: "instagram",
      accountExternalId: "user",
      accountUsername: "test",
      displayName: "Test",
      accessToken: "token",
      refreshToken: null,
      tokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      scopes: [],
      status: "active",
      rawProfile: {},
      createdAt: "",
      updatedAt: "",
    });

    const insightUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));

    expect(insightUrl.searchParams.get("metric")).toContain("views");
    expect(result[0]?.metrics.views).toBe(70321);
    expect(result[0]?.metrics.reach).toBe(50260);
    expect(result[0]?.metrics.saves).toBe(2279);
  });
});
