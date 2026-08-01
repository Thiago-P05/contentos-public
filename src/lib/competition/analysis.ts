import OpenAI from "openai";
import { z } from "zod";
import { env } from "@/lib/env";
import { withLangfuseGeneration } from "@/lib/observability/langfuse";
import type {
  CompetitionWindowAggregate,
  CompetitorAnalysisReport,
  CompetitorContentSnapshot,
  CompetitorProfile,
} from "@/lib/competition/types";

const looseReportSchema = z.object({}).passthrough();

let competitionClient: OpenAI | null = null;

function getCompetitionClient() {
  const apiKey =
    env.OPENROUTER_API_KEY_ANALYSIS_COMPETENCIA ??
    env.OPENROUTER_API_KEY_ANALYSIS ??
    env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OpenRouter no está configurado para análisis de competencia.");
  }

  competitionClient ??= new OpenAI({
    apiKey,
    baseURL: env.OPENROUTER_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": env.APP_URL ?? "http://localhost:3000",
      "X-OpenRouter-Title": "ContentOS",
    },
  });

  return competitionClient;
}

function formatPost(post: CompetitorContentSnapshot) {
  return {
    externalPostId: post.externalPostId,
    mediaType: post.mediaType,
    publishedAt: post.publishedAt,
    caption: post.caption,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    viewCount: post.viewCount,
    permalink: post.permalink,
  };
}

function buildPrompt(input: {
  profile: CompetitorProfile;
  posts: CompetitorContentSnapshot[];
  aggregates30d: CompetitionWindowAggregate;
  topByViews: CompetitorContentSnapshot[];
  topByComments: CompetitorContentSnapshot[];
}) {
  return [
    "Analizá una cuenta competidora de Instagram y devolvé solo JSON válido.",
    "Objetivo: identificar qué formatos, temas y hooks parecen estar funcionando mejor según métricas visibles públicas.",
    "No inventes datos faltantes. Si una conclusión depende de evidencia parcial, acláralo en caveats.",
    "Campos requeridos: summary, winningFormats, winningTopics, recurringHooks, observations, caveats.",
    "",
    JSON.stringify(
      {
        profile: {
          username: input.profile.username,
          displayName: input.profile.displayName,
          biography: input.profile.biography,
          followerCount: input.profile.followerCount,
          followingCount: input.profile.followingCount,
          postsCount: input.profile.postsCount,
        },
        aggregates30d: input.aggregates30d,
        topByViews: input.topByViews.map(formatPost),
        topByComments: input.topByComments.map(formatPost),
        recentPosts: input.posts
          .slice()
          .sort((left, right) => {
            const rightTime = right.publishedAt ? new Date(right.publishedAt).getTime() : 0;
            const leftTime = left.publishedAt ? new Date(left.publishedAt).getTime() : 0;
            return rightTime - leftTime;
          })
          .slice(0, 12)
          .map(formatPost),
      },
      null,
      2,
    ),
  ].join("\n");
}

function normalizeResponseText(content: unknown) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

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

function normalizeJsonBlock(raw: string) {
  if (!raw.startsWith("```")) {
    return raw;
  }

  return raw.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "").trim();
}

function stringifyReportEntry(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const primary =
    [record.label, record.name, record.title, record.text, record.value, record.format, record.topic, record.hook]
      .find((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      ?.trim() ?? null;
  const detail =
    [record.reason, record.rationale, record.explanation, record.why, record.description]
      .find((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      ?.trim() ?? null;

  if (primary && detail && !primary.includes(detail)) {
    return `${primary}: ${detail}`;
  }

  return primary ?? detail;
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => stringifyReportEntry(entry))
    .filter((entry): entry is string => Boolean(entry && entry.trim()));
}

export function parseCompetitionReport(raw: string): CompetitorAnalysisReport {
  const normalized = normalizeJsonBlock(raw);
  const parsed = looseReportSchema.parse(JSON.parse(normalized));
  const summary =
    stringifyReportEntry(parsed.summary) ?? "No se pudo generar un resumen estructurado.";

  return {
    summary,
    winningFormats: normalizeStringList(parsed.winningFormats),
    winningTopics: normalizeStringList(parsed.winningTopics),
    recurringHooks: normalizeStringList(parsed.recurringHooks),
    observations: normalizeStringList(parsed.observations),
    caveats: normalizeStringList(parsed.caveats),
    rawPayload: {
      parsed,
    },
  };
}

export async function generateCompetitionReport(input: {
  profile: CompetitorProfile;
  posts: CompetitorContentSnapshot[];
  aggregates30d: CompetitionWindowAggregate;
  topByViews: CompetitorContentSnapshot[];
  topByComments: CompetitorContentSnapshot[];
}) {
  const client = getCompetitionClient();
  const prompt = buildPrompt(input);
  const model =
    env.OPENROUTER_ANALYSIS_COMPETENCIA_MODEL ?? env.OPENROUTER_ANALYSIS_MODEL;
  const response = await withLangfuseGeneration(
    {
      name: "competition.analysis.openrouter",
      model,
      modelParameters: { temperature: 0.2 },
      input: {
        username: input.profile.username,
        posts: input.posts.length,
        topByViews: input.topByViews.length,
        topByComments: input.topByComments.length,
        prompt,
      },
      metadata: {
        provider: "openrouter",
        agentType: "competition_analysis",
        username: input.profile.username,
      },
      output: (result) => normalizeResponseText(result.choices[0]?.message.content),
      usage: (result) => ({
        inputTokens: result.usage?.prompt_tokens ?? null,
        outputTokens: result.usage?.completion_tokens ?? null,
        totalTokens: result.usage?.total_tokens ?? null,
      }),
    },
    () => client.chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: prompt }] as never,
        },
      ],
    }),
  );

  const raw = normalizeResponseText(response.choices[0]?.message.content);
  const report = parseCompetitionReport(raw);

  return {
    ...report,
    rawPayload: {
      ...report.rawPayload,
      provider: "openrouter",
      model,
      raw,
    },
  } satisfies CompetitorAnalysisReport;
}
