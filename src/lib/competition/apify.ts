import { env } from "@/lib/env";
import type {
  CompetitorContentMediaType,
  NormalizedCompetitorDataset,
  NormalizedCompetitorPostInput,
} from "@/lib/competition/types";

type ApifyDatasetItem = Record<string, unknown>;

function actorPath(actorId: string) {
  const normalized = actorId.trim();

  if (!normalized) {
    return "";
  }

  if (normalized.includes("/") && !normalized.includes("~")) {
    const [owner, name] = normalized.split("/", 2);
    return `${encodeURIComponent(owner ?? "")}~${encodeURIComponent(name ?? "")}`;
  }

  return encodeURIComponent(normalized);
}

function toRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readPath<T>(value: unknown, path: string[]) {
  let current: unknown = value;

  for (const segment of path) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) {
        return null;
      }
      current = current[index];
      continue;
    }

    const record = toRecord(current);
    if (!record) {
      return null;
    }
    current = record[segment];
  }

  return (current as T | undefined) ?? null;
}

function firstString(source: unknown, paths: string[][]) {
  for (const path of paths) {
    const candidate = readPath<unknown>(source, path);
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function firstBoolean(source: unknown, paths: string[][]) {
  for (const path of paths) {
    const candidate = readPath<unknown>(source, path);
    if (typeof candidate === "boolean") {
      return candidate;
    }
  }

  return null;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[^\d.,-]/g, "").replace(/,/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function firstNumber(source: unknown, paths: string[][]) {
  for (const path of paths) {
    const candidate = readPath<unknown>(source, path);
    const normalized = normalizeNumber(candidate);
    if (normalized !== null) {
      return normalized;
    }
  }

  return null;
}

function firstArray(source: unknown, paths: string[][]) {
  for (const path of paths) {
    const candidate = readPath<unknown>(source, path);
    if (Array.isArray(candidate)) {
      return candidate as unknown[];
    }
  }

  return [];
}

function normalizeIsoDate(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(value > 10_000_000_000 ? value : value * 1000);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return null;
}

function normalizeMediaType(source: unknown): CompetitorContentMediaType {
  const rawType =
    firstString(source, [
      ["mediaType"],
      ["media_type"],
      ["type"],
      ["productType"],
      ["product_type"],
      ["__typename"],
    ])?.toLowerCase() ?? "";

  if (rawType.includes("reel")) {
    return "reel";
  }

  if (rawType.includes("carousel") || rawType.includes("sidecar")) {
    return "carousel";
  }

  if (rawType.includes("image") || rawType.includes("photo")) {
    return "image";
  }

  if (rawType.includes("video")) {
    return "video";
  }

  return "unknown";
}

function normalizePost(source: unknown): NormalizedCompetitorPostInput | null {
  const externalPostId =
    firstString(source, [["id"], ["shortCode"], ["shortcode"], ["code"]]) ??
    firstString(source, [["permalink"], ["url"]]);

  if (!externalPostId) {
    return null;
  }

  return {
    externalPostId,
    permalink: firstString(source, [["permalink"], ["url"]]),
    caption: firstString(source, [["caption"], ["edge_media_to_caption", "edges", "0", "node", "text"]]),
    mediaType: normalizeMediaType(source),
    publishedAt:
      normalizeIsoDate(readPath<unknown>(source, ["timestamp"])) ??
      normalizeIsoDate(readPath<unknown>(source, ["takenAtTimestamp"])) ??
      normalizeIsoDate(readPath<unknown>(source, ["taken_at_timestamp"])) ??
      normalizeIsoDate(readPath<unknown>(source, ["publishedAt"])) ??
      normalizeIsoDate(readPath<unknown>(source, ["createdAt"])),
    thumbnailUrl: firstString(source, [
      ["thumbnailUrl"],
      ["thumbnail_url"],
      ["displayUrl"],
      ["display_url"],
      ["imageUrl"],
      ["image_url"],
    ]),
    likeCount: firstNumber(source, [["likesCount"], ["likes_count"], ["likes"], ["likeCount"]]),
    commentCount: firstNumber(source, [
      ["commentsCount"],
      ["comments_count"],
      ["comments"],
      ["commentCount"],
    ]),
    viewCount: firstNumber(source, [
      ["videoViewCount"],
      ["video_view_count"],
      ["videoPlayCount"],
      ["video_play_count"],
      ["videoPlayCounter"],
      ["video_play_counter"],
      ["videoViews"],
      ["viewCount"],
      ["viewsCount"],
      ["video_views"],
    ]),
    rawPayload: toRecord(source) ?? {},
  };
}

function findProfileCandidate(items: ApifyDatasetItem[]) {
  return (
    items.find((item) =>
      Boolean(
        firstString(item, [["username"], ["ownerUsername"], ["user", "username"]]) ||
          firstString(item, [["ownerFullName"], ["owner", "full_name"], ["owner", "fullName"]]) ||
          firstArray(item, [["latestPosts"], ["posts"]]).length > 0,
      ),
    ) ?? null
  );
}

function collectCandidatePosts(items: ApifyDatasetItem[]) {
  const candidates: unknown[] = [];

  for (const item of items) {
    const embeddedPosts = firstArray(item, [
      ["latestPosts"],
      ["posts"],
      ["latest_posts"],
      ["items"],
    ]);

    if (embeddedPosts.length > 0) {
      candidates.push(...embeddedPosts);
      continue;
    }

    if (normalizePost(item)) {
      candidates.push(item);
    }
  }

  const seen = new Set<string>();
  const posts: NormalizedCompetitorPostInput[] = [];

  for (const candidate of candidates) {
    const normalized = normalizePost(candidate);

    if (!normalized || seen.has(normalized.externalPostId)) {
      continue;
    }

    seen.add(normalized.externalPostId);
    posts.push(normalized);
  }

  return posts;
}

export function mapApifyInstagramDataset(
  items: ApifyDatasetItem[],
  normalizedUrl: string,
  username: string,
): NormalizedCompetitorDataset {
  const profileCandidate = findProfileCandidate(items);
  const profileSource = profileCandidate ?? {};
  const posts = collectCandidatePosts(items);
  const isPrivate = firstBoolean(profileSource, [["private"], ["isPrivate"], ["user", "is_private"]]);

  if (isPrivate) {
    throw new Error("El perfil es privado y no se puede analizar.");
  }

  return {
    profile: {
      platform: "instagram",
      username:
        firstString(profileSource, [
          ["username"],
          ["ownerUsername"],
          ["user", "username"],
          ["owner", "username"],
        ]) ??
        username,
      sourceUrl: normalizedUrl,
      displayName: firstString(profileSource, [
        ["fullName"],
        ["full_name"],
        ["name"],
        ["ownerFullName"],
        ["owner", "full_name"],
        ["owner", "fullName"],
      ]),
      biography: firstString(profileSource, [
        ["biography"],
        ["bio"],
        ["biographyText"],
        ["ownerBiography"],
      ]),
      profileImageUrl: firstString(profileSource, [
        ["profilePicUrl"],
        ["profile_pic_url"],
        ["profilePictureUrl"],
        ["profile_picture_url"],
        ["ownerProfilePicUrl"],
        ["owner", "profile_pic_url"],
      ]),
      followerCount: firstNumber(profileSource, [
        ["followersCount"],
        ["followers_count"],
        ["followers"],
        ["followedBy"],
        ["ownerFollowersCount"],
      ]),
      followingCount: firstNumber(profileSource, [
        ["followingCount"],
        ["following_count"],
        ["followsCount"],
        ["follows"],
        ["ownerFollowingCount"],
      ]),
      postsCount: firstNumber(profileSource, [
        ["postsCount"],
        ["posts_count"],
        ["posts"],
        ["igtvVideoCount"],
        ["ownerPostsCount"],
      ]),
      rawPayload: profileCandidate ?? {},
    },
    posts,
    sourceProvider: "apify",
    rawPayload: {
      items,
    },
  };
}

export async function fetchCompetitorInstagramProfileFromApify(
  normalizedUrl: string,
  username: string,
) {
  if (!env.APIFY_TOKEN || !env.APIFY_INSTAGRAM_ACTOR_ID) {
    throw new Error("Apify no está configurado para análisis de competencia.");
  }

  const url = new URL(
    `https://api.apify.com/v2/acts/${actorPath(env.APIFY_INSTAGRAM_ACTOR_ID)}/run-sync-get-dataset-items`,
  );
  url.searchParams.set("token", env.APIFY_TOKEN);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      directUrls: [normalizedUrl],
      resultsType: "posts",
      resultsLimit: 40,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const rawBody = await response.text();
    throw new Error(
      `Apify error: ${response.status} ${response.statusText}${rawBody ? ` - ${rawBody}` : ""}`,
    );
  }

  const items = (await response.json()) as ApifyDatasetItem[];
  return mapApifyInstagramDataset(items, normalizedUrl, username);
}
