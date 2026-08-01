import { describe, expect, it } from "vitest";
import { INSTAGRAM_DAILY_METRIC_PLAN } from "@/lib/clients/instagram-daily";

describe("instagram daily client", () => {
  it("ingesta follows desde follower_count y no desde el delta neto", () => {
    const followsPlan = INSTAGRAM_DAILY_METRIC_PLAN.find((plan) => plan.target === "follows");

    expect(followsPlan?.candidates).toEqual(["follower_count"]);
    expect(followsPlan?.candidates).not.toContain("follows_and_unfollows");
  });
});
