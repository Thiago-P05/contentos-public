import { describe, expect, it } from "vitest";
import { sanitizeForLangfuse } from "@/lib/observability/langfuse";

describe("sanitizeForLangfuse", () => {
  it("redacts secrets and bearer tokens", () => {
    expect(
      sanitizeForLangfuse({
        authorization: "Bearer abc123456789",
        apiKey: "sk-lf-secret-value-123456",
        nested: "token=abc123 secret=hidden",
      }),
    ).toEqual({
      authorization: "[redacted]",
      apiKey: "[redacted]",
      nested: "token=[redacted] secret=[redacted]",
    });
  });

  it("redacts media urls and truncates long strings", () => {
    const result = sanitizeForLangfuse({
      mediaUrl: "https://signed.example.com/video.mp4?token=secret",
      prompt: "x".repeat(6_100),
    }) as Record<string, unknown>;

    expect(result.mediaUrl).toBe("[redacted]");
    expect(String(result.prompt)).toContain("[truncated");
  });
});
