import {
  claimContentAnalysisItem,
  maybeAnalyzeContentItem,
  type ContentAnalysisResult,
} from "@/lib/content-analysis-agent";
import {
  maybeTranscribeReel,
  type ReelTranscriptionResult,
} from "@/lib/reel-transcription";
import { isVideoEligibleForTranscript } from "@/lib/content-media";
import type { ContentItem } from "@/lib/types";
import { setAnalysisState } from "@/lib/supabase/repository";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function runManualContentAnalysis(item: ContentItem): Promise<{
  claimed: true;
  transcription: ReelTranscriptionResult;
  analysis: ContentAnalysisResult;
} | {
  claimed: false;
  reason?: "transcription_processing";
}> {
  const claimToken = await claimContentAnalysisItem(item);
  if (!claimToken) {
    return { claimed: false };
  }

  let transcription: ReelTranscriptionResult;

  try {
    transcription = await maybeTranscribeReel(item, { retryFailed: true });
  } catch (error) {
    transcription = {
      eligible: isVideoEligibleForTranscript(item),
      attempted: false,
      durationMs: 0,
      outcome: "failed",
      error: getErrorMessage(error),
    };
  }

  if (transcription.outcome === "skipped") {
    await setAnalysisState(item.id, {
      analysisStatus: item.analysisStatus === "failed" ? "failed" : "pending",
      expectedProcessingStartedAt: claimToken,
    });
    return { claimed: false, reason: "transcription_processing" };
  }

  const analysis = await maybeAnalyzeContentItem(item, {
    retryFailed: true,
    claimToken,
  });
  return { claimed: true, transcription, analysis };
}
