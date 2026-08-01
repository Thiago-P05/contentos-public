import { buildStrategicAnalysisPrompt } from "@/lib/ai/prompts/base";
import type { InsightPromptProfile } from "@/lib/ai/prompts/types";
import { getContentPreviewAssets } from "@/lib/content-media";
import { stripHtml } from "@/lib/utils";
import type {
  AnalysisEvidenceMode,
  AnalysisInput,
  ContentItem,
  PlatformConnectionBriefFields,
  TextAsset,
} from "@/lib/types";

export { HOOK_TYPE_OPTIONS } from "@/lib/ai/prompts/contract";
export type { InsightPromptProfile } from "@/lib/ai/prompts/types";

export type AnalysisRemoteAsset = {
  label: string;
  url: string;
};

export type AnalysisPlan = {
  promptProfile: InsightPromptProfile;
  evidenceMode: AnalysisEvidenceMode;
  prompt: string;
  remoteAssets: AnalysisRemoteAsset[];
};

function asUpperString(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : null;
}

export function getInsightPromptProfile(item: ContentItem): InsightPromptProfile {
  const rawPayload = item.rawPayload as Record<string, unknown> | null;

  // Instagram-specific fields
  const mediaProductType = asUpperString(rawPayload?.media_product_type);
  const mediaType = asUpperString(rawPayload?.media_type);

  if (mediaProductType === "STORY" || mediaType === "STORY") {
    return "instagram_story";
  }

  if (mediaType === "CAROUSEL_ALBUM") {
    return "carousel";
  }

  if (item.platform === "youtube") {
    return "long_video";
  }

  // TikTok: media_type = 2 means photo carousel (IMAGE_POST)
  if (item.platform === "tiktok") {
    const tiktokMediaType = rawPayload?.media_type;
    if (tiktokMediaType === 2 || tiktokMediaType === "2" || tiktokMediaType === "IMAGE_POST") {
      return "carousel";
    }
  }

  return "short_video";
}

export function buildMetadataFallbackText(item: ContentItem) {
  return [
    "Plataforma: " + item.platform,
    item.title ? "Titulo: " + stripHtml(item.title) : null,
    item.description ? "Descripcion: " + stripHtml(item.description) : null,
    item.caption ? "Caption: " + stripHtml(item.caption) : null,
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join("\n");
}

export function chooseAnalysisInput(
  item: ContentItem,
  textAssets: TextAsset[],
): AnalysisInput {
  const platformCaption = textAssets.find(
    (textAsset) => textAsset.sourceType === "platform_caption" && textAsset.content.trim(),
  );
  const officialCaption = textAssets.find(
    (textAsset) => textAsset.sourceType === "official_caption" && textAsset.content.trim(),
  );
  const transcript = textAssets.find(
    (textAsset) => textAsset.sourceType === "transcript" && textAsset.content.trim(),
  );
  const caption = officialCaption ?? platformCaption;

  if (caption && transcript) {
    return {
      sourceType: "transcript",
      content: [
        "Caption:",
        caption.content,
        "",
        "Transcripcion:",
        transcript.content,
      ].join("\n"),
    };
  }

  if (transcript) {
    return {
      sourceType: transcript.sourceType,
      content: transcript.content,
    };
  }

  if (caption) {
    return {
      sourceType: caption.sourceType,
      content: caption.content,
    };
  }

  return {
    sourceType: "metadata_fallback",
    content: buildMetadataFallbackText(item),
  };
}

export function buildAnalysisPlan(
  item: ContentItem,
  analysisInput: AnalysisInput,
  brief: PlatformConnectionBriefFields,
): AnalysisPlan {
  const promptProfile = getInsightPromptProfile(item);
  const previewAssets = getContentPreviewAssets(item);
  const remoteAssets: AnalysisRemoteAsset[] = [];
  let evidenceMode: AnalysisEvidenceMode = "text_only";
  // Prefer transcript/text analysis over re-sending full video when a ready transcript exists.
  // Multimodal video is expensive; transcript already captures spoken content for reels.
  const hasReadyTranscript = analysisInput.sourceType === "transcript";

  if (
    promptProfile === "short_video" &&
    item.platform === "instagram" &&
    item.mediaUrl &&
    !hasReadyTranscript
  ) {
    evidenceMode = "multimodal_video";
    remoteAssets.push({ label: "Video principal", url: item.mediaUrl });
  } else if (promptProfile === "carousel" && previewAssets.length > 0) {
    evidenceMode = "multimodal_carousel";

    for (const [index, asset] of previewAssets.entries()) {
      const assetUrl = asset.mediaUrl ?? asset.thumbnailUrl;

      if (!assetUrl) {
        continue;
      }

      remoteAssets.push({
        label: "Lamina " + String(index + 1),
        url: assetUrl,
      });
    }
  } else if (item.thumbnailUrl) {
    // Use the available cover when the source video cannot be sent as multimodal evidence.
    evidenceMode = "text_plus_cover";
    remoteAssets.push({ label: "Portada", url: item.thumbnailUrl });
  }

  if (remoteAssets.length === 0) {
    evidenceMode = "text_only";
  }

  const prompt = buildStrategicAnalysisPrompt({
    promptProfile,
    evidenceMode,
    platform: item.platform,
    analysisInput,
    brief,
  });

  return {
    promptProfile,
    evidenceMode,
    prompt,
    remoteAssets,
  };
}
