import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchYouTubeVideos } from "@/lib/clients/youtube";
import type { PlatformConnectionCredentials } from "@/lib/types";

const connection: PlatformConnectionCredentials = {
  id: "youtube-connection",
  platform: "youtube",
  accountExternalId: "UC123",
  accountUsername: "@creator",
  displayName: "Creator",
  accessToken: "access-token",
  refreshToken: "refresh-token",
  tokenExpiresAt: null,
  refreshTokenExpiresAt: null,
  scopes: [],
  status: "active",
  rawProfile: {},
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), { status: 200 });
}

describe("fetchYouTubeVideos", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("normalizes uploaded videos in batches with metadata and statistics", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ contentDetails: { relatedPlaylists: { uploads: "UU123" } } }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ contentDetails: { videoId: "video-1" } }, { contentDetails: { videoId: "video-2" } }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "video-1",
              snippet: {
                title: "Titulo",
                description: "Descripcion",
                publishedAt: "2026-06-01T12:00:00Z",
                defaultLanguage: "es",
                thumbnails: { high: { url: "https://image.test/high.jpg" } },
              },
              contentDetails: { duration: "PT1H2M3S" },
              statistics: { viewCount: "101", likeCount: "10", commentCount: "3" },
            },
            {
              id: "video-2",
              snippet: { publishedAt: "2025-01-01T12:00:00Z" },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          columnHeaders: [
            { name: "video" },
            { name: "averageViewDuration" },
            { name: "averageViewPercentage" },
            { name: "estimatedMinutesWatched" },
            { name: "subscribersGained" },
          ],
          rows: [["video-1", 102, 48.5, 2040, 18]],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { items, excludedVideoIds, analytics } = await fetchYouTubeVideos(connection);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      platform: "youtube",
      externalId: "video-1",
      durationSeconds: 3723,
      permalink: "https://www.youtube.com/watch?v=video-1",
      thumbnailUrl: "https://image.test/high.jpg",
      mediaUrl: null,
      metrics: {
        views: 101,
        likes: 10,
        comments: 3,
        averageViewDurationSeconds: 102,
        averageViewPercentage: 48.5,
        watchTimeMinutes: 2040,
        subscribersGained: 18,
      },
      textAssets: [{ sourceType: "official_caption", content: "Descripcion", language: "es" }],
    });
    expect(excludedVideoIds).toEqual([]);
    expect(analytics).toEqual({
      requestedVideoCount: 2,
      reportedVideoCount: 1,
      warning: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
    const analyticsUrl = new URL(fetchMock.mock.calls[4]![0] as string);
    expect(analyticsUrl.searchParams.get("ids")).toBe("channel==UC123");
  });

  it("excluye videos no listados y devuelve sus IDs para removerlos del catalogo", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ contentDetails: { relatedPlaylists: { uploads: "UU123" } } }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ items: [{ contentDetails: { videoId: "unlisted-1" } }] }))
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "unlisted-1",
              snippet: { publishedAt: "2026-06-01T12:00:00Z" },
              status: { privacyStatus: "unlisted" },
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchYouTubeVideos(connection)).resolves.toEqual({
      items: [],
      excludedVideoIds: ["unlisted-1"],
      analytics: {
        requestedVideoCount: 0,
        reportedVideoCount: 0,
        warning: null,
      },
    });
  });

  it("excluye videos de las playlists Curso y No listado aunque sean publicos", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ contentDetails: { relatedPlaylists: { uploads: "UU123" } } }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            { contentDetails: { videoId: "course-video" } },
            { contentDetails: { videoId: "visible-video" } },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            { id: "PL-course", snippet: { title: "CURSO" } },
            { id: "PL-unlisted", snippet: { title: "No listado" } },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ items: [{ contentDetails: { videoId: "course-video" } }] }))
      .mockResolvedValueOnce(jsonResponse({ items: [{ contentDetails: { videoId: "another-hidden-video" } }] }))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "course-video",
              snippet: { publishedAt: "2026-06-01T12:00:00Z" },
              status: { privacyStatus: "public" },
            },
            {
              id: "visible-video",
              snippet: { publishedAt: "2026-06-02T12:00:00Z" },
              status: { privacyStatus: "public" },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ columnHeaders: [], rows: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchYouTubeVideos(connection)).resolves.toMatchObject({
      items: [{ externalId: "visible-video" }],
      excludedVideoIds: ["course-video", "another-hidden-video"],
      analytics: {
        requestedVideoCount: 1,
        reportedVideoCount: 0,
        warning: "YouTube Analytics no devolvio metricas por video para esta cuenta.",
      },
    });
  });
});
