import type { PlatformConnection } from "@/lib/types";

export type AutomaticAgentSettings = {
  autoAnalysisEnabled: boolean;
  autoTranscriptionEnabled: boolean;
};

export function resolveAutomaticAgentSettings(
  connection?: Pick<
    PlatformConnection,
    "autoAnalysisEnabled" | "autoTranscriptionEnabled"
  > | null,
): AutomaticAgentSettings {
  return {
    autoAnalysisEnabled: connection?.autoAnalysisEnabled !== false,
    autoTranscriptionEnabled: connection?.autoTranscriptionEnabled !== false,
  };
}
