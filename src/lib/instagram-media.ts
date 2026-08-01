import type { ContentItem } from "@/lib/types";

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

export type InstagramPreviewAsset = {
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
  } satisfies InstagramPreviewAsset;
}

export function getInstagramContentKind(rawPayload: Record<string, unknown>) {
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

export function getInstagramPreviewAssets(item: Pick<ContentItem, "id" | "mediaUrl" | "thumbnailUrl" | "permalink" | "rawPayload">) {
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
    .filter((asset): asset is InstagramPreviewAsset => asset !== null);

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
