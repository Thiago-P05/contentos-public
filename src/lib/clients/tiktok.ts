import { BACKFILL_START_ISO } from "@/lib/constants";
import type { MetricMap, NormalizedContentInput, PlatformConnectionCredentials } from "@/lib/types";

type TikTokVideo = {
  id?: string;
  title?: string;
  video_description?: string;
  duration?: number;
  cover_image_url?: string;
  share_url?: string;
  embed_link?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  create_time?: number | string;
  // media_type: 1 = video, 2 = photo carousel (IMAGE_POST)
  media_type?: number;
};

type TikTokVideoResponse = {
  data?: {
    videos?: TikTokVideo[];
    cursor?: number | string;
    has_more?: boolean;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

type TikTokApiError = {
  code?: string;
  message?: string;
};

function isTikTokApiError(value: unknown): value is { error: TikTokApiError } {
  if (!value || typeof value !== "object") return false;
  const error = (value as Record<string, unknown>).error;
  const code = error && typeof error === "object" ? (error as TikTokApiError).code : null;
  return Boolean(code && code !== "ok" && code !== "0");
}

export async function fetchTikTokJson<T>(
  url: URL,
  accessToken: string,
  init?: { method?: "GET" | "POST"; body?: Record<string, unknown> },
) {
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: "Bearer " + accessToken,
      ...(init?.body ? { "Content-Type": "application/json; charset=UTF-8" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const rawBody = await response.text();
  if (!response.ok) {
    throw new Error(`TikTok API error: ${response.status} ${response.statusText}`);
  }

  let payload: T;
  try {
    payload = JSON.parse(rawBody) as T;
  } catch {
    throw new Error("TikTok API devolvio una respuesta invalida.");
  }

  if (isTikTokApiError(payload)) {
    throw new Error(`TikTok API error: ${payload.error.code}`);
  }

  return payload;
}


function normalizeTikTokTimestamp(value: number | string | undefined) {
  let date: Date;

  if (typeof value === "number") {
    date = new Date(value * 1000);
  } else if (typeof value === "string") {
    const numeric = Number(value);

    date = Number.isFinite(numeric) ? new Date(numeric * 1000) : new Date(value);
  } else {
    return null;
  }

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function fetchTikTokVideos(connection: PlatformConnectionCredentials) {
  const results: NormalizedContentInput[] = [];
  const seenIds = new Set<string>();
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const url = new URL("https://open.tiktokapis.com/v2/video/list/");

    url.searchParams.set(
      "fields",
      [
        "id",
        "title",
        "video_description",
        "duration",
        "cover_image_url",
        "share_url",
        "embed_link",
        "view_count",
        "like_count",
        "comment_count",
        "share_count",
        "create_time",
        "media_type",
      ].join(","),
    );
    const payload: TikTokVideoResponse = await fetchTikTokJson<TikTokVideoResponse>(url, connection.accessToken, {
      method: "POST",
      body: {
        max_count: 20,
        ...(cursor ? { cursor } : {}),
      },
    });
    const videos = payload.data?.videos ?? [];
    let reachedBackfillBoundary = false;

    for (const video of videos) {
      const publishedAt = normalizeTikTokTimestamp(video.create_time);

      if (!video.id || !publishedAt) {
        continue;
      }

      if (new Date(publishedAt).getTime() < new Date(BACKFILL_START_ISO).getTime()) {
        reachedBackfillBoundary = true;
        continue;
      }

      if (seenIds.has(video.id)) {
        continue;
      }
      seenIds.add(video.id);

      const metrics: MetricMap = {
        views: typeof video.view_count === "number" ? video.view_count : null,
        likes: typeof video.like_count === "number" ? video.like_count : null,
        comments: typeof video.comment_count === "number" ? video.comment_count : null,
        shares: typeof video.share_count === "number" ? video.share_count : null,
      };

      results.push({
        platform: "tiktok",
        connectionId: connection.id,
        externalId: video.id,
        publishedAt,
        title: video.title ?? null,
        description: video.video_description ?? null,
        caption: video.video_description ?? null,
        durationSeconds: typeof video.duration === "number" ? Math.round(video.duration) : null,
        permalink: video.share_url ?? video.embed_link ?? null,
        thumbnailUrl: video.cover_image_url ?? null,
        mediaUrl: null,
        metrics,
        rawPayload: video as unknown as Record<string, unknown>,
        textAssets: video.video_description
          ? [
              {
                sourceType: "platform_caption",
                content: video.video_description,
                language: "es",
                rawPayload: {
                  from: "tiktok-description",
                },
              },
            ]
          : [],
      });
    }

    const nextCursor: number | string | undefined = payload.data?.cursor;

    cursor =
      typeof nextCursor === "number"
        ? String(nextCursor)
        : typeof nextCursor === "string"
          ? nextCursor
          : null;
    hasMore = !reachedBackfillBoundary && payload.data?.has_more === true && Boolean(cursor);
  }

  return results;
}
