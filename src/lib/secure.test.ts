import { createSignedPayload, decryptSecret, encryptSecret, verifySignedPayload } from "@/lib/secure";
import { describe, expect, it } from "vitest";

describe("secure helpers", () => {
  it("encripta y desencripta secretos", () => {
    process.env.CONNECTION_ENCRYPTION_SECRET = "super-secret-key-for-tests";

    const encrypted = encryptSecret("token-123");

    expect(encrypted).not.toBe("token-123");
    expect(decryptSecret(encrypted)).toBe("token-123");
  });

  it("firma y valida payloads", () => {
    process.env.CONNECTION_ENCRYPTION_SECRET = "super-secret-key-for-tests";

    const signed = createSignedPayload({
      platform: "instagram",
      nonce: "abc",
    });

    expect(verifySignedPayload<{ platform: string; nonce: string }>(signed)).toEqual({
      platform: "instagram",
      nonce: "abc",
    });
  });

});
