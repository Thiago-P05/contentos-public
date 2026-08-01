import { describe, expect, it } from "vitest";
import { resolveAutomaticAgentSettings } from "@/lib/agent-settings";

describe("resolveAutomaticAgentSettings", () => {
  it("preserva el comportamiento activo cuando faltan preferencias", () => {
    expect(resolveAutomaticAgentSettings()).toEqual({
      autoAnalysisEnabled: true,
      autoTranscriptionEnabled: true,
    });
  });

  it.each([
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ])("resuelve analysis=%s y transcription=%s", (analysis, transcription) => {
    expect(
      resolveAutomaticAgentSettings({
        autoAnalysisEnabled: analysis,
        autoTranscriptionEnabled: transcription,
      }),
    ).toEqual({
      autoAnalysisEnabled: analysis,
      autoTranscriptionEnabled: transcription,
    });
  });
});
