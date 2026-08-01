import { describe, expect, it } from "vitest";
import { mapApifyInstagramDataset } from "@/lib/competition/apify";

describe("apify instagram mapper", () => {
  it("maps a profile payload with embedded latest posts", () => {
    const result = mapApifyInstagramDataset(
      [
        {
          username: "competidor.ai",
          fullName: "Competidor AI",
          biography: "Automatizamos ventas con IA",
          followersCount: 12345,
          followsCount: 321,
          postsCount: 88,
          profilePicUrl: "https://cdn.example.com/profile.jpg",
          latestPosts: [
            {
              id: "post-1",
              type: "Reel",
              caption: "Hook fuerte",
              timestamp: "2026-04-22T10:00:00.000Z",
              likesCount: 100,
              commentsCount: 12,
              videoViewCount: 5000,
              displayUrl: "https://cdn.example.com/post-1.jpg",
              permalink: "https://www.instagram.com/reel/post-1/",
            },
            {
              id: "post-2",
              type: "Image",
              caption: "Carrusel",
              timestamp: "2026-04-18T10:00:00.000Z",
              likesCount: 50,
              commentsCount: 4,
              displayUrl: "https://cdn.example.com/post-2.jpg",
              permalink: "https://www.instagram.com/p/post-2/",
            },
          ],
        },
      ],
      "https://www.instagram.com/competidor.ai/",
      "competidor.ai",
    );

    expect(result.profile.username).toBe("competidor.ai");
    expect(result.profile.displayName).toBe("Competidor AI");
    expect(result.profile.followerCount).toBe(12345);
    expect(result.posts).toHaveLength(2);
    expect(result.posts[0]).toMatchObject({
      externalPostId: "post-1",
      mediaType: "reel",
      viewCount: 5000,
      commentCount: 12,
    });
    expect(result.posts[1]).toMatchObject({
      externalPostId: "post-2",
      mediaType: "image",
      viewCount: null,
    });
  });

  it("maps official posts output and derives profile info from owner fields", () => {
    const result = mapApifyInstagramDataset(
      [
        {
          id: "post-10",
          type: "Video",
          shortCode: "C123",
          caption: "Video con views",
          timestamp: "2026-04-23T09:00:00.000Z",
          commentsCount: 14,
          likesCount: 120,
          videoViewCount: 8500,
          displayUrl: "https://cdn.example.com/post-10.jpg",
          url: "https://www.instagram.com/p/C123/",
          ownerUsername: "owner.ai",
          ownerFullName: "Owner AI",
          ownerProfilePicUrl: "https://cdn.example.com/owner.jpg",
        },
      ],
      "https://www.instagram.com/owner.ai/",
      "owner.ai",
    );

    expect(result.profile.username).toBe("owner.ai");
    expect(result.profile.displayName).toBe("Owner AI");
    expect(result.profile.profileImageUrl).toBe("https://cdn.example.com/owner.jpg");
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0]).toMatchObject({
      externalPostId: "post-10",
      mediaType: "video",
      viewCount: 8500,
      commentCount: 14,
    });
  });
});
