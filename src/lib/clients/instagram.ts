import {
  BACKFILL_START_ISO,
  INSTAGRAM_CAROUSEL_INSIGHT_METRIC_CANDIDATES,
  INSTAGRAM_INSIGHT_METRICS,
} from "@/lib/constants";
import { env } from "@/lib/env";
import { getContentPreviewAssets } from "@/lib/content-media";
import type { MetricMap, NormalizedContentInput, PlatformConnectionCredentials } from "@/lib/types";

type InstagramMediaChild = {
  id?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
};

type InstagramMedia = {
  id: string;
  caption?: string;
  media_product_type?: string;
  media_type?: string;
  media_url?: string;
  permalink?: string;
  thumbnail_url?: string;
  timestamp: string;
  children?: {
    data?: InstagramMediaChild[];
  };
};

type MediaResponse = {
  data: InstagramMedia[];
  paging?: {
    next?: string;
  };
};

type InsightResponse = {
  data: Array<{
    name: string;
    values?: Array<{
      value?: number;
    }>;
  }>;
};

async function fetchGraph<T>(url: URL | string) {
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    const rawBody = await response.text();

    throw new Error(
      `Instagram API error: ${response.status} ${response.statusText}${
        rawBody ? ` - ${rawBody}` : ""
      }`,
    );
  }

  return (await response.json()) as T;
}

async function fetchInsights(connection: PlatformConnectionCredentials, mediaId: string) {
  const url = new URL(
    (connection.id === "legacy-instagram-env" ? env.INSTAGRAM_API_BASE_URL + "/" + env.INSTAGRAM_GRAPH_API_VERSION : "https://graph.instagram.com/" + env.INSTAGRAM_GRAPH_API_VERSION) + "/" + mediaId + "/insights",
  );

  url.searchParams.set("metric", INSTAGRAM_INSIGHT_METRICS.join(","));
  url.searchParams.set("access_token", connection.accessToken);

  try {
    const response = await fetchGraph<InsightResponse>(url);
    return response.data.reduce<MetricMap>((accumulator, metric) => {
      const normalizedMetricName = metric.name === "saved" ? "saves" : metric.name;
      accumulator[normalizedMetricName] = metric.values?.[0]?.value ?? null;
      return accumulator;
    }, {});
  } catch (error) {
    console.warn(
      `No se pudieron obtener insights para Instagram media ${mediaId}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
    return {};
  }
}

async function fetchCarouselInsights(connection: PlatformConnectionCredentials, mediaId: string) {
  for (const candidate of INSTAGRAM_CAROUSEL_INSIGHT_METRIC_CANDIDATES) {
    const url = new URL(
      (connection.id === "legacy-instagram-env" ? env.INSTAGRAM_API_BASE_URL + "/" + env.INSTAGRAM_GRAPH_API_VERSION : "https://graph.instagram.com/" + env.INSTAGRAM_GRAPH_API_VERSION) + "/" + mediaId + "/insights",
    );

    url.searchParams.set("metric", candidate.join(","));
    url.searchParams.set("access_token", connection.accessToken);

    try {
      const response = await fetchGraph<InsightResponse>(url);
      return response.data.reduce<MetricMap>((accumulator, metric) => {
        const normalizedMetricName = metric.name === "saved" ? "saves" : metric.name;
        accumulator[normalizedMetricName] = metric.values?.[0]?.value ?? null;
        return accumulator;
      }, {});
    } catch {
      continue;
    }
  }

  console.warn(`No se pudieron obtener insights para carrusel ${mediaId}.`);
  return {};
}

export async function fetchInstagramContent(connection: PlatformConnectionCredentials) {
  const collected: NormalizedContentInput[] = [];
  const connectionId = connection.id === "legacy-instagram-env" ? null : connection.id;
  let nextUrl: string | null =
    (connection.id === "legacy-instagram-env" ? env.INSTAGRAM_API_BASE_URL + "/" + env.INSTAGRAM_GRAPH_API_VERSION : "https://graph.instagram.com/" + env.INSTAGRAM_GRAPH_API_VERSION) + "/" + connection.accountExternalId + "/media" +
    `?fields=id,caption,media_product_type,media_type,media_url,permalink,thumbnail_url,timestamp,children{id,media_type,media_url,thumbnail_url,permalink}` +
    `&limit=50&access_token=${connection.accessToken}`;

  while (nextUrl) {
    const page: MediaResponse = await fetchGraph<MediaResponse>(nextUrl);

    for (const media of page.data) {
      const isReel = media.media_product_type === "REELS";
      const isCarousel = media.media_type === "CAROUSEL_ALBUM";

      if (!isReel && !isCarousel) {
        continue;
      }

      if (new Date(media.timestamp).getTime() < new Date(BACKFILL_START_ISO).getTime()) {
        continue;
      }

      const previewAssets = getContentPreviewAssets({
        id: media.id,
        platform: "instagram",
        mediaUrl: media.media_url ?? null,
        thumbnailUrl: media.thumbnail_url ?? null,
        permalink: media.permalink ?? null,
        rawPayload: media,
      });
      const primaryAsset = previewAssets[0] ?? null;
      const metrics = isReel
        ? await fetchInsights(connection, media.id)
        : await fetchCarouselInsights(connection, media.id);

      collected.push({
        platform: "instagram",
        connectionId,
        externalId: media.id,
        publishedAt: media.timestamp,
        title: null,
        description: null,
        caption: media.caption ?? null,
        durationSeconds: null,
        permalink: media.permalink ?? null,
        thumbnailUrl:
          media.thumbnail_url ?? primaryAsset?.thumbnailUrl ?? primaryAsset?.mediaUrl ?? null,
        mediaUrl: media.media_url ?? primaryAsset?.mediaUrl ?? null,
        metrics,
        rawPayload: media,
        textAssets: media.caption
          ? [
              {
                sourceType: "platform_caption",
                content: media.caption,
                language: "es",
                rawPayload: {
                  from: "instagram-caption",
                },
              },
            ]
          : [],
      });
    }

    nextUrl = page.paging?.next ?? null;
  }

  return collected;
}

type InstagramCommentNode = {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
  like_count?: number;
  replies?: {
    data?: InstagramCommentNode[];
  };
};

type InstagramCommentsResponse = {
  data: InstagramCommentNode[];
  paging?: {
    next?: string;
  };
};

function normalizeInstagramComment(
  node: InstagramCommentNode,
  connectionId: string,
  contentItemId: string,
  parentCommentExternalId: string | null,
) {
  if (!node.text?.trim() || !node.timestamp) {
    return null;
  }

  return {
    platform: "instagram" as const,
    connectionId,
    contentItemId,
    externalCommentId: node.id,
    authorUsername: node.username ?? null,
    authorDisplayName: node.username ?? null,
    text: node.text.trim(),
    commentedAt: node.timestamp,
    likeCount: Number(node.like_count ?? 0),
    isReply: Boolean(parentCommentExternalId),
    parentCommentExternalId,
    rawPayload: node as Record<string, unknown>,
  };
}

export async function fetchInstagramComments(
  connection: PlatformConnectionCredentials,
  contentItemId: string,
  mediaExternalId: string,
) {
  if (connection.id === "legacy-instagram-env") {
    return [];
  }

  const comments = [];
  let nextUrl: string | null =
    (connection.id === "legacy-instagram-env" ? env.INSTAGRAM_API_BASE_URL + "/" + env.INSTAGRAM_GRAPH_API_VERSION : "https://graph.instagram.com/" + env.INSTAGRAM_GRAPH_API_VERSION) + "/" + mediaExternalId +
    "/comments?fields=id,text,username,timestamp,like_count,replies{id,text,username,timestamp,like_count}&limit=50&access_token=" +
    connection.accessToken;





  while (nextUrl) {
    const page: InstagramCommentsResponse = await fetchGraph<InstagramCommentsResponse>(nextUrl);

    for (const node of page.data) {
      const parent = normalizeInstagramComment(node, connection.id, contentItemId, null);
      if (parent) {
        comments.push(parent);
      }

      for (const reply of node.replies?.data ?? []) {
        const normalizedReply = normalizeInstagramComment(
          reply,
          connection.id,
          contentItemId,
          node.id,
        );
        if (normalizedReply) {
          comments.push(normalizedReply);
        }
      }
    }

    nextUrl = page.paging?.next ?? null;
  }

  return comments;
}
