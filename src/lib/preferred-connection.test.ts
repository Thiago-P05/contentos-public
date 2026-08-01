import { describe, expect, it } from "vitest";
import { resolvePreferredConnectionId } from "@/lib/preferred-connection";
import type { PlatformConnection } from "@/lib/types";

function buildConnection(
  id: string,
  accountUsername: string | null,
): PlatformConnection {
  return {
    id,
    platform: "instagram",
    accountExternalId: `ext-${id}`,
    accountUsername,
    displayName: accountUsername,
    tokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    scopes: [],
    status: "active",
    rawProfile: {},
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  };
}

describe("preferred connection", () => {
  it("prioriza una connection valida pedida en URL", () => {
    const connections = [
      buildConnection("one", "primera-cuenta"),
      buildConnection("two", "otra-cuenta"),
    ];

    expect(resolvePreferredConnectionId(connections, "two")).toBe("two");
  });

  it("usa la cuenta preferida configurada si no hay seleccion explicita", () => {
    const connections = [
      buildConnection("one", "otra-cuenta"),
      buildConnection("two", "cuenta-preferida"),
    ];

    expect(resolvePreferredConnectionId(connections, null, "cuenta-preferida")).toBe("two");
  });

  it("usa la primera cuenta disponible cuando no existe la preferida", () => {
    const connections = [
      buildConnection("one", "otra-cuenta"),
      buildConnection("two", "segunda"),
    ];

    expect(resolvePreferredConnectionId(connections, null, "cuenta-preferida")).toBe("one");
  });

  it("usa la primera cuenta disponible cuando no hay preferencia configurada", () => {
    const connections = [
      buildConnection("one", "otra-cuenta"),
      buildConnection("two", "segunda"),
    ];

    expect(resolvePreferredConnectionId(connections, null, "")).toBe("one");
  });

  it("no matchea cuentas sin username cuando no hay preferencia configurada", () => {
    const connections = [buildConnection("one", null), buildConnection("two", "segunda")];

    expect(resolvePreferredConnectionId(connections, null, "")).toBe("one");
  });
});
