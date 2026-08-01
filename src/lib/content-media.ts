import type { ContentItem, Platform, TextAsset } from "@/lib/types";

type RawInstagramChild = {
  id?: unknown;
  media_type?: unknown;
  media_url?: unknown;
  thumbnail_url?: unknown;
  permalink?: unknown;
};

type RawInstagramPayload = {
  id?: unknown;
  media_type?: unknown;
  media_product_type?: unknown;
  media_url?: unknown;
  thumbnail_url?: unknown;
  permalink?: unknown;
  children?: {
    data?: unknown;
  };
};

export type ContentPreviewAsset = {
  id: string;
  mediaType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
};

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function toPreviewAsset(rawChild: RawInstagramChild, fallbackId: string) {
  return {
    id: asString(rawChild.id) ?? fallbackId,
    mediaType: asString(rawChild.media_type),
    mediaUrl: asString(rawChild.media_url),
    thumbnailUrl: asString(rawChild.thumbnail_url),
    permalink: asString(rawChild.permalink),
  } satisfies ContentPreviewAsset;
}

function getInstagramContentKind(rawPayload: Record<string, unknown>) {
  const payload = rawPayload as RawInstagramPayload;

  if (asString(payload.media_product_type) === "REELS") {
    return "Reel";
  }

  if (asString(payload.media_type) === "CAROUSEL_ALBUM") {
    return "Carrusel";
  }

  if (asString(payload.media_type) === "VIDEO") {
    return "Video";
  }

  return "Publicacion";
}

export function getContentKind(
  platform: Platform,
  rawPayload: Record<string, unknown>,
) {
  switch (platform) {
    case "instagram":
      return getInstagramContentKind(rawPayload);
    case "tiktok":
      return rawPayload.media_type === 2 || rawPayload.media_type === "IMAGE_POST"
        ? "Carrusel"
        : "Video";
    case "youtube":
      return "Video";
    default:
      return "Contenido";
  }
}

export function isInstagramReelEligibleForTranscript(
  item: Pick<ContentItem, "platform" | "mediaUrl" | "rawPayload">,
) {
  if (item.platform !== "instagram" || !item.mediaUrl) {
    return false;
  }

  if (asString(item.rawPayload.media_product_type) === "REELS") {
    return true;
  }

  return getContentKind(item.platform, item.rawPayload) === "Reel";
}

export function isVideoEligibleForTranscript(
  item: Pick<ContentItem, "platform" | "mediaUrl" | "rawPayload">,
) {
  if (!item.mediaUrl) {
    return false;
  }

  if (item.platform === "tiktok") {
    return true;
  }

  if (item.platform !== "instagram") {
    return false;
  }

  const kind = getContentKind(item.platform, item.rawPayload);
  return kind === "Reel" || kind === "Video";
}

export function isContentEligibleForAIBackfill(
  item: Pick<ContentItem, "platform" | "rawPayload">,
) {
  const kind = getContentKind(item.platform, item.rawPayload);
  return kind === "Reel" || kind === "Video" || kind === "Carrusel";
}

export function getTranscriptTextAsset(
  textAssets: Array<Pick<TextAsset, "sourceType" | "content"> & Partial<TextAsset>>,
) {
  return (
    textAssets.find(
      (textAsset) =>
        textAsset.sourceType === "transcript" &&
        typeof textAsset.content === "string" &&
        textAsset.content.trim().length > 0,
    ) ?? null
  );
}
export function getContentPreviewAssets(
  item: Pick<
    ContentItem,
    "id" | "platform" | "mediaUrl" | "thumbnailUrl" | "permalink" | "rawPayload"
  >,
) {
  if (item.platform === "instagram") {
    const payload = item.rawPayload as RawInstagramPayload;
    const children = asRecord(payload.children);
    const childData = Array.isArray(children?.data) ? children.data : [];
    const childAssets = childData
      .map((child, index) => {
        const rawChild = asRecord(child);

        if (!rawChild) {
          return null;
        }

        return toPreviewAsset(rawChild, `${item.id}-child-${index}`);
      })
      .filter((asset): asset is ContentPreviewAsset => asset !== null);

    if (childAssets.length > 0) {
      return childAssets;
    }

    return [
      {
        id: asString(payload.id) ?? item.id,
        mediaType: asString(payload.media_type),
        mediaUrl: item.mediaUrl ?? asString(payload.media_url),
        thumbnailUrl: item.thumbnailUrl ?? asString(payload.thumbnail_url),
        permalink: item.permalink ?? asString(payload.permalink),
      },
    ].filter((asset) => asset.mediaUrl || asset.thumbnailUrl);
  }

  return [
    {
      id: item.id,
      mediaType: "VIDEO",
      mediaUrl: item.mediaUrl,
      thumbnailUrl: item.thumbnailUrl,
      permalink: item.permalink,
    },
  ].filter((asset) => asset.mediaUrl || asset.thumbnailUrl || asset.permalink);
}
