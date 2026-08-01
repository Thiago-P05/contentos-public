import { describe, expect, it } from "vitest";
import {
  buildCompetitionWindowAggregate,
  getTopCompetitorPostsByComments,
  getTopCompetitorPostsByViews,
} from "@/lib/competition/metrics";
import type { CompetitorContentSnapshot } from "@/lib/competition/types";

const NOW = new Date("2026-04-24T20:00:00.000Z");

function makePost(
  id: string,
  overrides: Partial<CompetitorContentSnapshot>,
): CompetitorContentSnapshot {
  return {
    id,
    analysisRunId: "run-1",
    externalPostId: id,
    permalink: `https://www.instagram.com/p/${id}/`,
    caption: `caption ${id}`,
    mediaType: "reel",
    publishedAt: "2026-04-20T12:00:00.000Z",
    thumbnailUrl: null,
    likeCount: null,
    commentCount: null,
    viewCount: null,
    rawPayload: {},
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("competition metrics", () => {
  it("orders top posts by visible views and comments", () => {
    const posts = [
      makePost("a", { viewCount: 1200, commentCount: 8 }),
      makePost("b", { viewCount: 9000, commentCount: 3 }),
      makePost("c", { viewCount: null, commentCount: 22 }),
    ];

    expect(getTopCompetitorPostsByViews(posts).map((post) => post.externalPostId)).toEqual([
      "b",
      "a",
    ]);
    expect(getTopCompetitorPostsByComments(posts).map((post) => post.externalPostId)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("builds 30 day aggregates without converting null metrics to zero", () => {
    const posts = [
      makePost("recent-1", {
        mediaType: "reel",
        publishedAt: "2026-04-21T12:00:00.000Z",
        viewCount: 1000,
        commentCount: 20,
      }),
      makePost("recent-2", {
        mediaType: "carousel",
        publishedAt: "2026-04-10T12:00:00.000Z",
        viewCount: null,
        commentCount: 5,
      }),
      makePost("old", {
        mediaType: "image",
        publishedAt: "2026-03-01T12:00:00.000Z",
        viewCount: 9999,
        commentCount: 999,
      }),
    ];

    const aggregate = buildCompetitionWindowAggregate(posts, NOW);

    expect(aggregate.publishedPosts).toBe(2);
    expect(aggregate.totalVisibleViews).toBe(1000);
    expect(aggregate.postsWithVisibleViews).toBe(1);
    expect(aggregate.totalVisibleComments).toBe(25);
    expect(aggregate.postsWithVisibleComments).toBe(2);
    expect(aggregate.formatMix.map((entry) => entry.mediaType)).toEqual(["reel", "carousel"]);
  });
});
