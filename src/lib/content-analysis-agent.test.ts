import { describe, expect, it } from "vitest";
import {
  ANALYSIS_MAX_ATTEMPTS,
  ANALYSIS_PROCESSING_LEASE_MS,
  ANALYSIS_RETRY_COOLDOWN_MS,
  isAnalysisProcessingStale,
  shouldReuseExistingAnalysis,
  shouldSkipFailedAnalysis,
} from "@/lib/content-analysis-agent";
import type { AnalysisStatus, VideoPotentialEstimate } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDetail(input: {
  insightPresent?: boolean;
  videoPotential?: VideoPotentialEstimate | null;
  analysisStatus?: AnalysisStatus | null;
}): {
  insight: { videoPotential: VideoPotentialEstimate | null } | null;
  item: { analysisStatus: AnalysisStatus };
} {
  return {
    insight: input.insightPresent === false
      ? null
      : { videoPotential: input.videoPotential ?? null },
    item: { analysisStatus: input.analysisStatus ?? "pending" },
  };
}

const NOW = Date.now();
const ONE_HOUR_AGO = new Date(NOW - 60 * 60 * 1000).toISOString();
const TWENTY_FIVE_HOURS_AGO = new Date(NOW - 25 * 60 * 60 * 1000).toISOString();

describe("isAnalysisProcessingStale", () => {
  it("mantiene un claim reciente y recupera uno vencido", () => {
    expect(
      isAnalysisProcessingStale(
        {
          analysisStatus: "processing",
          analysisProcessingStartedAt: new Date(NOW - 60_000).toISOString(),
        },
        NOW,
      ),
    ).toBe(false);
    expect(
      isAnalysisProcessingStale(
        {
          analysisStatus: "processing",
          analysisProcessingStartedAt: new Date(
            NOW - ANALYSIS_PROCESSING_LEASE_MS,
          ).toISOString(),
        },
        NOW,
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// shouldReuseExistingAnalysis
// ---------------------------------------------------------------------------

describe("shouldReuseExistingAnalysis", () => {
  it("retorna true cuando insight presente + status ready", () => {
    expect(
      shouldReuseExistingAnalysis(
        buildDetail({ insightPresent: true, analysisStatus: "ready" }),
      ),
    ).toBe(true);
  });

  it("retorna true cuando insight presente + status fallback", () => {
    expect(
      shouldReuseExistingAnalysis(
        buildDetail({ insightPresent: true, analysisStatus: "fallback" }),
      ),
    ).toBe(true);
  });

  it("retorna true cuando insight presente SIN videoPotential + status ready (el caso del bug)", () => {
    expect(
      shouldReuseExistingAnalysis(
        buildDetail({ insightPresent: true, videoPotential: null, analysisStatus: "ready" }),
      ),
    ).toBe(true);
  });

  it("retorna false cuando insight es null", () => {
    expect(
      shouldReuseExistingAnalysis(
        buildDetail({ insightPresent: false, analysisStatus: "ready" }),
      ),
    ).toBe(false);
  });

  it("retorna false cuando status es failed (aunque exista insight)", () => {
    expect(
      shouldReuseExistingAnalysis(
        buildDetail({ insightPresent: true, analysisStatus: "failed" }),
      ),
    ).toBe(false);
  });

  it("retorna false cuando status es null", () => {
    expect(
      shouldReuseExistingAnalysis(
        buildDetail({ insightPresent: true, analysisStatus: null }),
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// shouldSkipFailedAnalysis
// ---------------------------------------------------------------------------

describe("shouldSkipFailedAnalysis", () => {
  it("retorna true cuando status failed y at hace 1h (dentro del cooldown)", () => {
    expect(
      shouldSkipFailedAnalysis("failed", { at: ONE_HOUR_AGO }, NOW),
    ).toBe(true);
  });

  it("retorna false cuando status failed y at hace 25h (fuera del cooldown)", () => {
    expect(
      shouldSkipFailedAnalysis("failed", { at: TWENTY_FIVE_HOURS_AGO }, NOW),
    ).toBe(false);
  });

  it("retorna true cuando attempts >= ANALYSIS_MAX_ATTEMPTS aunque at sea viejo", () => {
    expect(
      shouldSkipFailedAnalysis(
        "failed",
        { at: TWENTY_FIVE_HOURS_AGO, attempts: ANALYSIS_MAX_ATTEMPTS },
        NOW,
      ),
    ).toBe(true);
  });

  it("retorna true cuando attempts supera ANALYSIS_MAX_ATTEMPTS", () => {
    expect(
      shouldSkipFailedAnalysis(
        "failed",
        { at: TWENTY_FIVE_HOURS_AGO, attempts: ANALYSIS_MAX_ATTEMPTS + 2 },
        NOW,
      ),
    ).toBe(true);
  });

  it("retorna false cuando status es ready", () => {
    expect(
      shouldSkipFailedAnalysis("ready", { at: ONE_HOUR_AGO }, NOW),
    ).toBe(false);
  });

  it("retorna false cuando analysisError es undefined", () => {
    expect(shouldSkipFailedAnalysis("failed", undefined, NOW)).toBe(false);
  });

  it("retorna false cuando analysisError es null", () => {
    expect(shouldSkipFailedAnalysis("failed", null, NOW)).toBe(false);
  });

  it("retorna false cuando at no es parseable", () => {
    expect(
      shouldSkipFailedAnalysis("failed", { at: "not-a-date" }, NOW),
    ).toBe(false);
  });

  it("cooldown de 24h: exactamente en el limite es false (igual a cooldown)", () => {
    const exactlyAtCooldown = new Date(NOW - ANALYSIS_RETRY_COOLDOWN_MS).toISOString();
    // now - at === ANALYSIS_RETRY_COOLDOWN_MS → NOT < cooldown → false
    expect(
      shouldSkipFailedAnalysis("failed", { at: exactlyAtCooldown }, NOW),
    ).toBe(false);
  });
});
