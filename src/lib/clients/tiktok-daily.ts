import { fetchTikTokJson } from "@/lib/clients/tiktok";
import type { PlatformConnectionCredentials, PlatformDailyInsightInput } from "@/lib/types";

type TikTokUserResponse = {
  data?: {
    user?: {
      follower_count?: number;
      following_count?: number;
      likes_count?: number;
      video_count?: number;
    };
  };
};

function asCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function fetchTikTokDailyInsights(
  connection: PlatformConnectionCredentials,
): Promise<PlatformDailyInsightInput[]> {
  const url = new URL("https://open.tiktokapis.com/v2/user/info/");
  url.searchParams.set(
    "fields",
    "follower_count,following_count,likes_count,video_count",
  );
  const payload = await fetchTikTokJson<TikTokUserResponse>(url, connection.accessToken);
  const user = payload.data?.user ?? {};

  return [{
    platform: "tiktok",
    connectionId: connection.id,
    insightDate: new Date().toISOString().slice(0, 10),
    period: "day",
    views: null,
    impressions: null,
    reach: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    contentInteractions: null,
    profileVisits: null,
    linkClicks: null,
    follows: null,
    followerCount: asCount(user.follower_count),
    watchTimeMinutes: null,
    averageViewDurationSeconds: null,
    subscribersGained: null,
    subscribersLost: null,
    followingCount: asCount(user.following_count),
    profileLikesCount: asCount(user.likes_count),
    videoCount: asCount(user.video_count),
    rawPayload: {
      followerCount: asCount(user.follower_count),
      followingCount: asCount(user.following_count),
      profileLikesCount: asCount(user.likes_count),
      videoCount: asCount(user.video_count),
      provider: payload,
    },
  }];
}
