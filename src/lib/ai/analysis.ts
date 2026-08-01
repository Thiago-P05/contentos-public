import OpenAI from "openai";
import { extname } from "node:path";
import {
  buildAnalysisPlan,
  buildMetadataFallbackText,
  chooseAnalysisInput,
  getInsightPromptProfile,
  type InsightPromptProfile,
} from "@/lib/ai/analysis-strategy";
import { parseVideoPotentialEstimate } from "@/lib/ai/video-potential";
import { env } from "@/lib/env";
import { withLangfuseGeneration, withLangfuseSpan } from "@/lib/observability/langfuse";
import type {
  AnalysisInput,
  ContentItem,
  InsightDraft,
  PlatformConnectionBriefFields,
} from "@/lib/types";

export {
  buildAnalysisPlan,
  buildMetadataFallbackText,
  chooseAnalysisInput,
  getInsightPromptProfile,
};
export type { InsightPromptProfile };

type OpenRouterContentPart = Record<string, unknown>;

type EncodedOpenRouterAsset = {
  label: string;
  mimeType: string;
  contentType: string;
  part: OpenRouterContentPart;
};

let openRouterAnalysisClient: OpenAI | null = null;
let openRouterTranscriptionClient: OpenAI | null = null;

function createOpenRouterClient(apiKey: string) {
  return new OpenAI({
    apiKey,
    baseURL: env.OPENROUTER_BASE_URL,
    maxRetries: 0,
    timeout: 4 * 60 * 1000,
    defaultHeaders: {
      "HTTP-Referer": env.APP_URL ?? "http://localhost:3000",
      "X-OpenRouter-Title": "ContentOS",
    },
  });
}

function getOpenRouterClient(agent: "analysis" | "transcription") {
  const apiKey =
    agent === "analysis"
      ? env.OPENROUTER_API_KEY_ANALYSIS ?? env.OPENROUTER_API_KEY
      : env.OPENROUTER_API_KEY_TRANSCRIPTION ?? env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      agent === "analysis"
        ? "OpenRouter no esta configurado para analisis."
        : "OpenRouter no esta configurado para transcripcion.",
    );
  }

  if (agent === "analysis") {
    openRouterAnalysisClient ??= createOpenRouterClient(apiKey);
    return openRouterAnalysisClient;
  }

  openRouterTranscriptionClient ??= createOpenRouterClient(apiKey);
  return openRouterTranscriptionClient;
}

function normalizeModelJson(raw: string | undefined) {
  const value = raw?.trim() ?? "{}";

  if (!value.startsWith("```")) {
    return value;
  }

  return value.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "").trim();
}

function normalizeConfidence(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(1, value));
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    const numeric = Number(normalized.replace(",", "."));

    if (Number.isFinite(numeric)) {
      return Math.max(0, Math.min(1, numeric));
    }

    if (["alta", "high", "muy alta"].includes(normalized)) {
      return 0.85;
    }

    if (["media", "medium", "moderada"].includes(normalized)) {
      return 0.6;
    }

    if (["baja", "low", "muy baja"].includes(normalized)) {
      return 0.35;
    }
  }

  return 0.5;
}

function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
      )
    : [];
}

function getCompletionText(content: unknown) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

function inferMimeType(mediaUrl: string, contentType: string | null) {
  if (contentType) {
    return contentType.split(";")[0]?.trim() || "application/octet-stream";
  }

  const extension = extname(new URL(mediaUrl).pathname).toLowerCase();

  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".m4a":
      return "audio/mp4";
    case ".aac":
      return "audio/aac";
    case ".ogg":
      return "audio/ogg";
    case ".webm":
      return "video/webm";
    case ".mov":
      return "video/mov";
    default:
      return "video/mp4";
  }
}

function isImageMime(mimeType: string) {
  return mimeType.startsWith("image/");
}

function isAudioMime(mimeType: string) {
  return mimeType.startsWith("audio/");
}

function isVideoMime(mimeType: string) {
  return mimeType.startsWith("video/");
}

function getAudioFormat(mimeType: string) {
  switch (mimeType) {
    case "audio/mpeg":
      return "mp3";
    case "audio/mp4":
      return "m4a";
    case "audio/x-m4a":
      return "m4a";
    case "audio/aac":
      return "aac";
    case "audio/ogg":
      return "ogg";
    case "audio/flac":
      return "flac";
    case "audio/aiff":
      return "aiff";
    default:
      return "wav";
  }
}

async function inferRemoteAssetMimeType(mediaUrl: string) {
  try {
    const response = await fetch(mediaUrl, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    if (response.ok) {
      return inferMimeType(mediaUrl, response.headers.get("content-type"));
    }
  } catch {
    // Some media CDNs reject HEAD. Fall back to the URL extension.
  }

  return inferMimeType(mediaUrl, null);
}

async function downloadRemoteAsset(mediaUrl: string) {
  const response = await fetch(mediaUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new Error("No se pudo descargar media para OpenRouter: " + String(response.status));
  }

  return {
    mimeType: inferMimeType(mediaUrl, response.headers.get("content-type")),
    buffer: Buffer.from(await response.arrayBuffer()),
  };
}

async function buildOpenRouterMediaPart(
  mediaUrl: string,
  label: string,
): Promise<EncodedOpenRouterAsset> {
  const remoteMimeType = await inferRemoteAssetMimeType(mediaUrl);

  if (isVideoMime(remoteMimeType)) {
    return {
      label,
      mimeType: remoteMimeType,
      contentType: "video_url",
      part: {
        type: "video_url",
        videoUrl: { url: mediaUrl },
        video_url: { url: mediaUrl },
      },
    };
  }

  const { buffer, mimeType } = await downloadRemoteAsset(mediaUrl);
  const base64 = buffer.toString("base64");

  if (isImageMime(mimeType)) {
    const url = `data:${mimeType};base64,${base64}`;
    return {
      label,
      mimeType,
      contentType: "image_url",
      part: {
        type: "image_url",
        imageUrl: { url },
        image_url: { url },
      },
    };
  }

  if (isAudioMime(mimeType)) {
    const inputAudio = {
      data: base64,
      format: getAudioFormat(mimeType),
    };
    return {
      label,
      mimeType,
      contentType: "input_audio",
      part: {
        type: "input_audio",
        inputAudio,
        input_audio: inputAudio,
      },
    };
  }

  throw new Error(`Tipo de media no soportado para OpenRouter: ${mimeType}`);
}

export async function transcribeRemoteMedia(mediaUrl: string) {
  const client = getOpenRouterClient("transcription");
  const media = await withLangfuseSpan(
    {
      name: "content.transcription.prepare_media",
      input: { mediaUrl },
      metadata: { provider: "openrouter" },
      output: (asset) => ({ mimeType: asset.mimeType, contentType: asset.contentType }),
    },
    () => buildOpenRouterMediaPart(mediaUrl, "Media principal"),
  );
  const instruction = "Transcribi este audio o video en su idioma original. Devolve solo el texto plano, sin resumen ni comentarios.";
  const response = await withLangfuseGeneration(
    {
      name: "content.transcription.openrouter",
      model: env.OPENROUTER_TRANSCRIPTION_MODEL,
      modelParameters: { temperature: 0.1 },
      input: {
        instruction,
        media: { label: media.label, mimeType: media.mimeType, contentType: media.contentType },
      },
      metadata: { provider: "openrouter", agentType: "content_transcription" },
      output: (result) => getCompletionText(result.choices[0]?.message.content),
      usage: (result) => ({
        inputTokens: result.usage?.prompt_tokens ?? null,
        outputTokens: result.usage?.completion_tokens ?? null,
        totalTokens: result.usage?.total_tokens ?? null,
      }),
    },
    () => client.chat.completions.create({
      model: env.OPENROUTER_TRANSCRIPTION_MODEL,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: instruction,
            },
            media.part,
          ] as never,
        },
      ],
    }),
  );

  return getCompletionText(response.choices[0]?.message.content);
}

export async function generateInsight(
  item: ContentItem,
  analysisInput: AnalysisInput,
  brief: PlatformConnectionBriefFields,
): Promise<InsightDraft> {
  const client = getOpenRouterClient("analysis");
  const plan = buildAnalysisPlan(item, analysisInput, brief);
  const encodedAssets: EncodedOpenRouterAsset[] = [];

  for (const remoteAsset of plan.remoteAssets) {
    encodedAssets.push(await withLangfuseSpan(
      {
        name: "content.analysis.prepare_media",
        input: { label: remoteAsset.label, url: remoteAsset.url },
        metadata: {
          provider: "openrouter",
          contentItemId: item.id,
          externalId: item.externalId,
        },
        output: (asset) => ({ label: asset.label, mimeType: asset.mimeType, contentType: asset.contentType }),
      },
      () => buildOpenRouterMediaPart(remoteAsset.url, remoteAsset.label),
    ));
  }

  const content: OpenRouterContentPart[] = [{ type: "text", text: plan.prompt }];

  for (const asset of encodedAssets) {
    content.push({ type: "text", text: "Evidencia visual: " + asset.label });
    content.push(asset.part);
  }

  const response = await withLangfuseGeneration(
    {
      name: "content.analysis.openrouter",
      model: env.OPENROUTER_ANALYSIS_MODEL,
      modelParameters: { temperature: 0.2 },
      input: {
        contentItemId: item.id,
        externalId: item.externalId,
        platform: item.platform,
        evidenceMode: plan.evidenceMode,
        promptProfile: plan.promptProfile,
        prompt: plan.prompt,
        remoteAssets: encodedAssets.map((asset) => ({
          label: asset.label,
          mimeType: asset.mimeType,
          contentType: asset.contentType,
        })),
      },
      metadata: {
        provider: "openrouter",
        agentType: "content_analysis",
        contentItemId: item.id,
        externalId: item.externalId,
        evidenceMode: plan.evidenceMode,
      },
      output: (result) => getCompletionText(result.choices[0]?.message.content),
      usage: (result) => ({
        inputTokens: result.usage?.prompt_tokens ?? null,
        outputTokens: result.usage?.completion_tokens ?? null,
        totalTokens: result.usage?.total_tokens ?? null,
      }),
    },
    () => client.chat.completions.create({
      model: env.OPENROUTER_ANALYSIS_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: content as never,
        },
      ],
    }),
  );

  const raw = normalizeModelJson(getCompletionText(response.choices[0]?.message.content));
  const parsed = JSON.parse(raw) as Partial<InsightDraft> & {
    hookType?: unknown;
    hookAssessment?: unknown;
    videoPotential?: unknown;
  };

  const hookType =
    typeof parsed.hookType === "string" && parsed.hookType.trim()
      ? parsed.hookType.trim()
      : "otro";
  const hookAssessment =
    typeof parsed.hookAssessment === "string" && parsed.hookAssessment.trim()
      ? parsed.hookAssessment.trim()
      : null;
  const videoPotential = parseVideoPotentialEstimate(parsed.videoPotential);

  return {
    summary: parsed.summary ?? "No se pudo generar un resumen.",
    strengths: parseStringArray(parsed.strengths),
    weaknesses: parseStringArray(parsed.weaknesses),
    improvements: parseStringArray(parsed.improvements),
    topics: parseStringArray(parsed.topics),
    hooks: parseStringArray(parsed.hooks),
    hookType,
    hookAssessment,
    evidenceMode: plan.evidenceMode,
    confidence: normalizeConfidence(parsed.confidence),
    videoPotential,
    rawPayload: {
      provider: "openrouter",
      analysisInput,
      evidenceMode: plan.evidenceMode,
      promptProfile: plan.promptProfile,
      remoteAssets: encodedAssets.map((asset) => ({
        label: asset.label,
        mimeType: asset.mimeType,
        contentType: asset.contentType,
      })),
      model: env.OPENROUTER_ANALYSIS_MODEL,
      videoPotential,
      parsed,
    },
  };
}

export async function generateEmbedding(text: string) {
  void text;
  return [];
}
