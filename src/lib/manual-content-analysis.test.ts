import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentItem } from "@/lib/types";

const { analyzeMock, claimMock, setAnalysisStateMock, transcribeMock } = vi.hoisted(() => ({
  analyzeMock: vi.fn(),
  claimMock: vi.fn(),
  setAnalysisStateMock: vi.fn(),
  transcribeMock: vi.fn(),
}));

vi.mock("@/lib/content-analysis-agent", () => ({
  claimContentAnalysisItem: claimMock,
  maybeAnalyzeContentItem: analyzeMock,
}));

vi.mock("@/lib/reel-transcription", () => ({
  maybeTranscribeReel: transcribeMock,
}));

vi.mock("@/lib/supabase/repository", () => ({
  setAnalysisState: setAnalysisStateMock,
}));

import { runManualContentAnalysis } from "@/lib/manual-content-analysis";

const item = {
  id: "content-1",
  platform: "instagram",
  connectionId: "connection-1",
  externalId: "external-1",
  mediaUrl: "https://example.com/reel.mp4",
  rawPayload: { media_product_type: "REELS" },
} as unknown as ContentItem;

describe("runManualContentAnalysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    claimMock.mockResolvedValue("2026-07-25T00:00:00.000Z");
    setAnalysisStateMock.mockResolvedValue(true);
    transcribeMock.mockResolvedValue({
      eligible: true,
      attempted: true,
      durationMs: 10,
      outcome: "ready",
    });
    analyzeMock.mockResolvedValue({
      attempted: true,
      durationMs: 20,
      outcome: "ready",
    });
  });

  it("fuerza retries y transcribe antes de analizar", async () => {
    const order: string[] = [];
    transcribeMock.mockImplementation(async () => {
      order.push("transcription");
      return { eligible: true, attempted: true, durationMs: 10, outcome: "ready" };
    });
    analyzeMock.mockImplementation(async () => {
      order.push("analysis");
      return { attempted: true, durationMs: 20, outcome: "ready" };
    });

    await runManualContentAnalysis(item);

    expect(order).toEqual(["transcription", "analysis"]);
    expect(transcribeMock).toHaveBeenCalledWith(item, { retryFailed: true });
    expect(claimMock).toHaveBeenCalledWith(item);
    expect(analyzeMock).toHaveBeenCalledWith(item, {
      retryFailed: true,
      claimToken: "2026-07-25T00:00:00.000Z",
    });
  });

  it("continua con el analisis si la transcripcion lanza un error", async () => {
    transcribeMock.mockRejectedValue(new Error("fallo de transcripcion"));

    const result = await runManualContentAnalysis(item);

    expect(result.claimed).toBe(true);
    if (!result.claimed) throw new Error("Expected the manual claim to succeed.");
    expect(result.transcription.outcome).toBe("failed");
    expect(result.transcription.eligible).toBe(true);
    expect(analyzeMock).toHaveBeenCalledOnce();
  });

  it("no inicia trabajo pago cuando otro proceso obtuvo el claim", async () => {
    claimMock.mockResolvedValue(false);

    const result = await runManualContentAnalysis(item);

    expect(result).toEqual({ claimed: false });
    expect(transcribeMock).not.toHaveBeenCalled();
    expect(analyzeMock).not.toHaveBeenCalled();
  });

  it("libera el analisis si otra ejecucion sigue transcribiendo", async () => {
    transcribeMock.mockResolvedValue({
      eligible: true,
      attempted: false,
      durationMs: 0,
      outcome: "skipped",
    });

    const result = await runManualContentAnalysis(item);

    expect(result).toEqual({ claimed: false, reason: "transcription_processing" });
    expect(setAnalysisStateMock).toHaveBeenCalledWith(item.id, {
      analysisStatus: "pending",
      expectedProcessingStartedAt: "2026-07-25T00:00:00.000Z",
    });
    expect(analyzeMock).not.toHaveBeenCalled();
  });
});
