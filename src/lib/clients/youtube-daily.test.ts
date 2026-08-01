import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchYouTubeDailyInsights } from "@/lib/clients/youtube-daily";
import type { PlatformConnectionCredentials } from "@/lib/types";

const connection: PlatformConnectionCredentials = {
  id: "youtube-connection",
  platform: "youtube",
  accountExternalId: "UC123",
  accountUsername: null,
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

describe("fetchYouTubeDailyInsights", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps YouTube Analytics daily rows to the shared insight contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          columnHeaders: [
            { name: "day" },
            { name: "views" },
            { name: "engagedViews" },
            { name: "likes" },
            { name: "comments" },
            { name: "shares" },
            { name: "estimatedMinutesWatched" },
            { name: "averageViewDuration" },
            { name: "subscribersGained" },
            { name: "subscribersLost" },
          ],
          rows: [["2026-06-01", 100, 80, 12, 3, 2, 250.5, 42.5, 4, 1]],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const rows = await fetchYouTubeDailyInsights(connection, { since: "2026-06-01" });

    expect(rows).toEqual([
      expect.objectContaining({
        platform: "youtube",
        connectionId: "youtube-connection",
        insightDate: "2026-06-01",
        views: 100,
        likes: 12,
        comments: 3,
        shares: 2,
        watchTimeMinutes: 250.5,
        averageViewDurationSeconds: 42.5,
        follows: 4,
        subscribersGained: 4,
        subscribersLost: 1,
      }),
    ]);
    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.searchParams.get("ids")).toBe("channel==MINE");
    expect(url.searchParams.get("dimensions")).toBe("day");
  });
});
