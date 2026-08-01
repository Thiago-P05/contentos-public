import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTikTokVideos } from "@/lib/clients/tiktok";
import type { PlatformConnectionCredentials } from "@/lib/types";

const connection: PlatformConnectionCredentials = {
  id: "connection-1",
  platform: "tiktok",
  accountExternalId: "open-id",
  accountUsername: "creator",
  displayName: "Creator",
  accessToken: "access-token",
  refreshToken: "refresh-token",
  tokenExpiresAt: null,
  refreshTokenExpiresAt: null,
  scopes: ["video.list"],
  status: "active",
  rawProfile: {},
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("TikTok content client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("normaliza publicaciones y conserva metricas no disponibles como null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: {
            has_more: false,
            videos: [
              {
                id: "video-1",
                create_time: 1767225600,
                video_description: "Descripcion",
                view_count: 120,
                media_type: 2,
              },
            ],
          },
        }),
      ),
    );

    const videos = await fetchTikTokVideos(connection);

    expect(videos).toHaveLength(1);
    expect(videos[0]).toMatchObject({
      externalId: "video-1",
      mediaUrl: null,
      metrics: { views: 120, likes: null, comments: null, shares: null },
    });
  });

  it("detiene la paginacion al llegar al limite de backfill", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          cursor: 1,
          has_more: true,
          videos: [{ id: "old-video", create_time: 1577836800 }],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchTikTokVideos(connection)).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rechaza errores de proveedor aunque la respuesta HTTP sea 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ error: { code: "scope_not_authorized", message: "missing scope" } }),
      ),
    );

    await expect(fetchTikTokVideos(connection)).rejects.toThrow("scope_not_authorized");
  });
});
