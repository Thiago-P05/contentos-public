import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getTikTokAuthorizationRemovedOpenId,
  verifyTikTokWebhookSignature,
} from "@/lib/tiktok-webhook";

describe("TikTok webhooks", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("valida firmas vigentes y extrae authorization.removed", () => {
    vi.stubEnv("TIKTOK_CLIENT_SECRET", "test-secret");
    const body = JSON.stringify({ event: "authorization.removed", user: { open_id: "open-id" } });
    const timestamp = "1767225600";
    const signature = createHmac("sha256", "test-secret")
      .update(`${timestamp}.${body}`)
      .digest("hex");

    expect(
      verifyTikTokWebhookSignature(`t=${timestamp},s=${signature}`, body, 1767225600000),
    ).toBe(true);
    expect(getTikTokAuthorizationRemovedOpenId(JSON.parse(body))).toBe("open-id");
  });

  it("rechaza firmas vencidas y eventos no relacionados", () => {
    vi.stubEnv("TIKTOK_CLIENT_SECRET", "test-secret");
    expect(verifyTikTokWebhookSignature("t=1,s=bad", "{}", 1767225600000)).toBe(false);
    expect(getTikTokAuthorizationRemovedOpenId({ event: "video.publish.completed" })).toBeNull();
  });
});
