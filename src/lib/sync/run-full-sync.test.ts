import { describe, expect, it, vi } from "vitest";
import { formatSyncWarning } from "@/lib/sync/run-full-sync";

vi.mock("server-only", () => ({}));

describe("sync warning formatter", () => {
  it("formats an invalid credentials warning", () => {
    expect(formatSyncWarning("instagram", "account-123", "invalid-credentials")).toBe(
      "instagram:account-123: credenciales invalidas \u2014 conexion omitida",
    );
  });

  it("formats a daily insights warning", () => {
    expect(formatSyncWarning("tiktok", "account-456", "daily-insights")).toBe(
      "tiktok:account-456: datos diarios no actualizados",
    );
  });

  it("formats a content sync warning for YouTube", () => {
    expect(formatSyncWarning("youtube", "UC123", "content")).toBe(
      "youtube:UC123: contenido no actualizado",
    );
  });

  it("never includes raw external errors", () => {
    const externalError = "OAuth failed: https://provider.test?access_token=secret";
    const warning = Reflect.apply(formatSyncWarning, null, [
      "instagram",
      "account-123",
      "invalid-credentials",
      externalError,
    ]);

    expect(warning).not.toContain(externalError);
    expect(warning).not.toContain("access_token");
  });
});
