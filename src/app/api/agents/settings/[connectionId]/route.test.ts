import { beforeEach, describe, expect, it, vi } from "vitest";

const { enforceSecurityMock, updateSettingsMock } = vi.hoisted(() => ({
  enforceSecurityMock: vi.fn(),
  updateSettingsMock: vi.fn(),
}));

vi.mock("@/lib/request-security", async () => {
  const actual = await vi.importActual<typeof import("@/lib/request-security")>(
    "@/lib/request-security",
  );
  return {
    ...actual,
    enforceApiRouteSecurity: enforceSecurityMock,
    logRouteError: vi.fn(),
  };
});

vi.mock("@/lib/supabase/repository", () => ({
  updatePlatformConnectionAgentSettings: updateSettingsMock,
}));

import { POST } from "@/app/api/agents/settings/[connectionId]/route";

const connectionId = "11111111-1111-4111-8111-111111111111";

function request(payload: unknown) {
  return new Request("https://content.test/api/agents/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/agents/settings/[connectionId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceSecurityMock.mockResolvedValue({ id: "user-1" });
    updateSettingsMock.mockResolvedValue({
      autoAnalysisEnabled: false,
      autoTranscriptionEnabled: true,
    });
  });

  it("guarda ambos controles con seguridad de ruta", async () => {
    const response = await POST(
      request({ autoAnalysisEnabled: false, autoTranscriptionEnabled: true }),
      { params: Promise.resolve({ connectionId }) },
    );

    expect(response.status).toBe(200);
    expect(enforceSecurityMock).toHaveBeenCalledWith(expect.any(Request), {
      bucket: "agent-settings",
      rateLimit: { limit: 20, windowSeconds: 300 },
    });
    expect(updateSettingsMock).toHaveBeenCalledWith(connectionId, {
      autoAnalysisEnabled: false,
      autoTranscriptionEnabled: true,
    });
  });

  it("rechaza payloads incompletos", async () => {
    const response = await POST(request({ autoAnalysisEnabled: true }), {
      params: Promise.resolve({ connectionId }),
    });

    expect(response.status).toBe(400);
    expect(updateSettingsMock).not.toHaveBeenCalled();
  });
});
