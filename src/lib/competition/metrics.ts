import type {
  CompetitionWindowAggregate,
  CompetitorContentSnapshot,
  CompetitionFormatMixEntry,
} from "@/lib/competition/types";

function toTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function summarizeNumeric(values: Array<number | null>) {
  const presentValues = values.filter((value): value is number => typeof value === "number");

  if (presentValues.length === 0) {
    return {
      total: null,
      average: null,
      count: 0,
    };
  }

  const total = presentValues.reduce((sum, value) => sum + value, 0);

  return {
    total,
    average: total / presentValues.length,
    count: presentValues.length,
  };
}

function buildFormatMix(posts: CompetitorContentSnapshot[]): CompetitionFormatMixEntry[] {
  if (posts.length === 0) {
    return [];
  }

  const counts = new Map<CompetitorContentSnapshot["mediaType"], number>();

  for (const post of posts) {
    counts.set(post.mediaType, (counts.get(post.mediaType) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([mediaType, count]) => ({
      mediaType,
      count,
      share: count / posts.length,
    }))
    .sort((left, right) => right.count - left.count);
}

function topByMetric(
  posts: CompetitorContentSnapshot[],
  selector: (post: CompetitorContentSnapshot) => number | null,
) {
  return [...posts]
    .filter((post) => selector(post) !== null)
    .sort((left, right) => {
      const rightValue = selector(right) ?? Number.NEGATIVE_INFINITY;
      const leftValue = selector(left) ?? Number.NEGATIVE_INFINITY;
      return rightValue - leftValue;
    })
    .slice(0, 5);
}

export function getTopCompetitorPostsByViews(posts: CompetitorContentSnapshot[]) {
  return topByMetric(posts, (post) => post.viewCount);
}

export function getTopCompetitorPostsByComments(posts: CompetitorContentSnapshot[]) {
  return topByMetric(posts, (post) => post.commentCount);
}

export function buildCompetitionWindowAggregate(
  posts: CompetitorContentSnapshot[],
  now = new Date(),
): CompetitionWindowAggregate {
  const windowEnd = new Date(now);
  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() - 30);

  const windowStartMs = windowStart.getTime();
  const windowEndMs = windowEnd.getTime();

  const windowPosts = posts.filter((post) => {
    const publishedAt = toTimestamp(post.publishedAt);
    return publishedAt !== null && publishedAt >= windowStartMs && publishedAt <= windowEndMs;
  });

  const viewStats = summarizeNumeric(windowPosts.map((post) => post.viewCount));
  const commentStats = summarizeNumeric(windowPosts.map((post) => post.commentCount));

  return {
    windowDays: 30,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    publishedPosts: windowPosts.length,
    postsPerWeek: windowPosts.length > 0 ? (windowPosts.length / 30) * 7 : null,
    totalVisibleViews: viewStats.total,
    averageVisibleViews: viewStats.average,
    postsWithVisibleViews: viewStats.count,
    totalVisibleComments: commentStats.total,
    averageVisibleComments: commentStats.average,
    postsWithVisibleComments: commentStats.count,
    formatMix: buildFormatMix(windowPosts),
  };
}
