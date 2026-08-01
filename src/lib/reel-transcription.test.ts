import { describe, expect, it } from "vitest";
import {
  TRANSCRIPTION_RETRY_COOLDOWN_MS,
  TRANSCRIPTION_PROCESSING_LEASE_MS,
  getReusableTranscriptState,
  isTranscriptionProcessingStale,
  shouldSkipFailedTranscription,
} from "@/lib/reel-transcription";
import type { TextAsset, TranscriptionStatus } from "@/lib/types";

function buildPersistedState(input: {
  transcriptionStatus?: TranscriptionStatus;
  transcriptionModel?: string | null;
  transcriptionError?: string | null;
  transcriptionUpdatedAt?: string | null;
}) {
  return {
    transcriptionStatus: input.transcriptionStatus ?? "pending",
    transcriptionModel: input.transcriptionModel ?? null,
    transcriptionError: input.transcriptionError ?? null,
    transcriptionUpdatedAt: input.transcriptionUpdatedAt ?? null,
  };
}

function buildTranscriptAsset(input: Partial<TextAsset> = {}): TextAsset {
  return {
    id: input.id ?? "text-1",
    contentItemId: input.contentItemId ?? "content-1",
    sourceType: "transcript",
    content: input.content ?? "Transcripcion existente",
    language: input.language ?? "es",
    rawPayload: input.rawPayload ?? {},
    createdAt: input.createdAt ?? "2026-04-01T00:00:00.000Z",
    updatedAt: input.updatedAt ?? "2026-04-02T00:00:00.000Z",
  };
}

describe("isTranscriptionProcessingStale", () => {
  const now = Date.now();

  it("mantiene un claim reciente y recupera uno vencido", () => {
    expect(
      isTranscriptionProcessingStale(
        buildPersistedState({
          transcriptionStatus: "processing",
          transcriptionUpdatedAt: new Date(now - 60_000).toISOString(),
        }),
        now,
      ),
    ).toBe(false);
    expect(
      isTranscriptionProcessingStale(
        buildPersistedState({
          transcriptionStatus: "processing",
          transcriptionUpdatedAt: new Date(
            now - TRANSCRIPTION_PROCESSING_LEASE_MS,
          ).toISOString(),
        }),
        now,
      ),
    ).toBe(true);
  });
});

describe("reel transcription reuse", () => {
  it("reutiliza transcripciones existentes aunque no tengan mediaUrl en metadata", () => {
    const state = getReusableTranscriptState(
      buildPersistedState({
        transcriptionStatus: "failed",
        transcriptionError: "error anterior",
      }),
      buildTranscriptAsset(),
    );

    expect(state).toMatchObject({
      transcriptionStatus: "ready",
      transcriptionError: null,
      transcriptionUpdatedAt: "2026-04-02T00:00:00.000Z",
      shouldUpdate: true,
    });
  });

  it("no fuerza update cuando el item ya esta listo y el transcript no trae modelo", () => {
    const state = getReusableTranscriptState(
      buildPersistedState({
        transcriptionStatus: "ready",
        transcriptionModel: "google/gemini-2.5-flash-lite",
      }),
      buildTranscriptAsset(),
    );

    expect(state).toMatchObject({
      transcriptionModel: "google/gemini-2.5-flash-lite",
      shouldUpdate: false,
    });
  });

  it("normaliza el modelo cuando la metadata del transcript lo trae", () => {
    const state = getReusableTranscriptState(
      buildPersistedState({
        transcriptionStatus: "ready",
        transcriptionModel: "old-model",
      }),
      buildTranscriptAsset({
        rawPayload: { model: "google/gemini-2.5-flash-lite" },
      }),
    );

    expect(state).toMatchObject({
      transcriptionModel: "google/gemini-2.5-flash-lite",
      shouldUpdate: true,
    });
  });
});

// ---------------------------------------------------------------------------
// shouldSkipFailedTranscription
// ---------------------------------------------------------------------------

describe("shouldSkipFailedTranscription", () => {
  const NOW = Date.now();
  const ONE_HOUR_AGO = new Date(NOW - 60 * 60 * 1000).toISOString();
  const TWENTY_FIVE_HOURS_AGO = new Date(NOW - 25 * 60 * 60 * 1000).toISOString();

  it("retorna true cuando status failed y updatedAt hace 1h (dentro del cooldown)", () => {
    expect(
      shouldSkipFailedTranscription(
        { transcriptionStatus: "failed", transcriptionUpdatedAt: ONE_HOUR_AGO },
        NOW,
      ),
    ).toBe(true);
  });

  it("retorna false cuando status failed y updatedAt hace 25h (fuera del cooldown)", () => {
    expect(
      shouldSkipFailedTranscription(
        { transcriptionStatus: "failed", transcriptionUpdatedAt: TWENTY_FIVE_HOURS_AGO },
        NOW,
      ),
    ).toBe(false);
  });

  it("retorna false cuando status es ready", () => {
    expect(
      shouldSkipFailedTranscription(
        { transcriptionStatus: "ready", transcriptionUpdatedAt: ONE_HOUR_AGO },
        NOW,
      ),
    ).toBe(false);
  });

  it("retorna false cuando transcriptionUpdatedAt es null", () => {
    expect(
      shouldSkipFailedTranscription(
        { transcriptionStatus: "failed", transcriptionUpdatedAt: null },
        NOW,
      ),
    ).toBe(false);
  });

  it("cooldown de 24h: exactamente en el limite es false (igual a cooldown)", () => {
    const exactlyAtCooldown = new Date(NOW - TRANSCRIPTION_RETRY_COOLDOWN_MS).toISOString();
    // now - at === TRANSCRIPTION_RETRY_COOLDOWN_MS → NOT < cooldown → false
    expect(
      shouldSkipFailedTranscription(
        { transcriptionStatus: "failed", transcriptionUpdatedAt: exactlyAtCooldown },
        NOW,
      ),
    ).toBe(false);
  });
});
