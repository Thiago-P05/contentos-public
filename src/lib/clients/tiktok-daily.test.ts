import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTikTokDailyInsights } from "@/lib/clients/tiktok-daily";
import type { PlatformConnectionCredentials } from "@/lib/types";

const connection: PlatformConnectionCredentials = {
  id: "connection-1",
  platform: "tiktok",
  accountExternalId: "open-id",
  accountUsername: null,
  displayName: "Creator",
  accessToken: "access-token",
  refreshToken: null,
  tokenExpiresAt: null,
  refreshTokenExpiresAt: null,
  scopes: ["user.info.stats"],
  status: "active",
  rawProfile: {},
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("TikTok daily profile client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("persiste los totales publicos de perfil como snapshot diario", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              user: {
                follower_count: 42,
                following_count: 7,
                likes_count: 390,
                video_count: 12,
              },
            },
          }),
          { status: 200 },
        ),
      ),
    );

    const [insight] = await fetchTikTokDailyInsights(connection);

    expect(insight).toMatchObject({
      platform: "tiktok",
      followerCount: 42,
      followingCount: 7,
      profileLikesCount: 390,
      videoCount: 12,
    });
  });
});
