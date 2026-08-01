import { beforeEach, describe, expect, it, vi } from "vitest";

const { enforceSecurityMock, getContentDetailMock, runManualAnalysisMock } = vi.hoisted(() => ({
  enforceSecurityMock: vi.fn(),
  getContentDetailMock: vi.fn(),
  runManualAnalysisMock: vi.fn(),
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
  getContentDetail: getContentDetailMock,
}));

vi.mock("@/lib/manual-content-analysis", () => ({
  runManualContentAnalysis: runManualAnalysisMock,
}));

import { POST } from "@/app/api/content/[id]/analyze/route";

const contentId = "22222222-2222-4222-8222-222222222222";

describe("POST /api/content/[id]/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceSecurityMock.mockResolvedValue({ id: "user-1" });
    getContentDetailMock.mockResolvedValue({
      item: { id: contentId, analysisStatus: "pending" },
    });
    runManualAnalysisMock.mockResolvedValue({
      claimed: true,
      transcription: { eligible: false, attempted: false, outcome: "not_applicable" },
      analysis: { attempted: true, outcome: "ready" },
    });
  });

  it("ejecuta manualmente contenido pendiente", async () => {
    const response = await POST(
      new Request(`https://content.test/api/content/${contentId}/analyze`, { method: "POST" }),
      { params: Promise.resolve({ id: contentId }) },
    );

    expect(response.status).toBe(200);
    expect(runManualAnalysisMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: contentId, analysisStatus: "pending" }),
    );
  });

  it("no vuelve a pagar un analisis terminal", async () => {
    getContentDetailMock.mockResolvedValue({
      item: { id: contentId, analysisStatus: "ready" },
    });

    const response = await POST(
      new Request(`https://content.test/api/content/${contentId}/analyze`, { method: "POST" }),
      { params: Promise.resolve({ id: contentId }) },
    );

    expect(response.status).toBe(409);
    expect(runManualAnalysisMock).not.toHaveBeenCalled();
  });

  it("rechaza una ejecucion cuando otro proceso obtuvo el claim", async () => {
    runManualAnalysisMock.mockResolvedValue({ claimed: false });

    const response = await POST(
      new Request(`https://content.test/api/content/${contentId}/analyze`, { method: "POST" }),
      { params: Promise.resolve({ id: contentId }) },
    );

    expect(response.status).toBe(409);
  });
});
