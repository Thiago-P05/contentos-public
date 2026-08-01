import {
  DEFAULT_OPENROUTER_ANALYSIS_MODEL,
  DEFAULT_OPENROUTER_TRANSCRIPTION_MODEL,
} from "@/lib/constants";
import type { Platform } from "@/lib/types";
import { z } from "zod";

function normalizeEnvValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

const envSchema = z.object({
  APP_URL: z.string().url().optional(),
  MCP_SERVER_URL: z.string().url().optional(),
  ALLOWED_USER_EMAIL: z.string().email().optional(),
  ALLOWED_USER_ID: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(1).optional(),
  CONNECTION_ENCRYPTION_SECRET: z.string().min(16).optional(),
  CRON_SECRET: z.string().min(1).optional(),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_API_KEY_ANALYSIS: z.string().min(1).optional(),
  OPENROUTER_API_KEY_ANALYSIS_COMPETENCIA: z.string().min(1).optional(),
  OPENROUTER_API_KEY_TRANSCRIPTION: z.string().min(1).optional(),
  OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  OPENROUTER_ANALYSIS_MODEL: z
    .string()
    .min(1)
    .default(DEFAULT_OPENROUTER_ANALYSIS_MODEL),
  OPENROUTER_ANALYSIS_COMPETENCIA_MODEL: z
    .string()
    .min(1)
    .default(DEFAULT_OPENROUTER_ANALYSIS_MODEL),
  OPENROUTER_TRANSCRIPTION_MODEL: z
    .string()
    .min(1)
    .default(DEFAULT_OPENROUTER_TRANSCRIPTION_MODEL),
  LANGFUSE_PUBLIC_KEY: z.string().min(1).optional(),
  LANGFUSE_SECRET_KEY: z.string().min(1).optional(),
  LANGFUSE_BASE_URL: z.string().url().default("https://cloud.langfuse.com"),
  LANGFUSE_ENABLED: z.enum(["true", "false"]).optional(),
  LANGFUSE_DEBUG: z.enum(["true", "false"]).optional(),
  APIFY_TOKEN: z.string().min(1).optional(),
  APIFY_INSTAGRAM_ACTOR_ID: z.string().min(1).optional(),
  OPUSCLIP_API_KEY: z.string().min(1).optional(),
  OPUSCLIP_ORG_ID: z.string().min(1).optional(),
  OPUSCLIP_API_BASE_URL: z.string().url().default("https://api.opus.pro/api"),
  INSTAGRAM_CLIENT_ID: z.string().min(1).optional(),
  INSTAGRAM_CLIENT_SECRET: z.string().min(1).optional(),
  INSTAGRAM_ACCESS_TOKEN: z.string().min(1).optional(),
  INSTAGRAM_USER_ID: z.string().min(1).optional(),
  INSTAGRAM_API_BASE_URL: z
    .string()
    .url()
    .default("https://graph.facebook.com"),
  INSTAGRAM_GRAPH_API_VERSION: z.string().min(1).default("v25.0"),
  TIKTOK_CLIENT_KEY: z.string().min(1).optional(),
  TIKTOK_CLIENT_SECRET: z.string().min(1).optional(),
  YOUTUBE_CLIENT_ID: z.string().min(1).optional(),
  YOUTUBE_CLIENT_SECRET: z.string().min(1).optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  // IDs de conexión separados por coma que NO deben generar análisis de IA
  // Útil para evitar doble análisis cuando el mismo contenido se publica en múltiples plataformas
  SKIP_AI_ANALYSIS_CONNECTIONS: z.string().optional(),
});

export function getEnv() {
  return envSchema.parse({
    APP_URL: normalizeEnvValue(process.env.APP_URL),
    MCP_SERVER_URL: normalizeEnvValue(process.env.MCP_SERVER_URL),
    ALLOWED_USER_EMAIL: normalizeEnvValue(process.env.ALLOWED_USER_EMAIL),
    ALLOWED_USER_ID: normalizeEnvValue(process.env.ALLOWED_USER_ID),
    AUTH_SECRET: normalizeEnvValue(process.env.AUTH_SECRET),
    CONNECTION_ENCRYPTION_SECRET: normalizeEnvValue(process.env.CONNECTION_ENCRYPTION_SECRET),
    CRON_SECRET: normalizeEnvValue(process.env.CRON_SECRET),
    OPENROUTER_API_KEY: normalizeEnvValue(process.env.OPENROUTER_API_KEY),
    OPENROUTER_API_KEY_ANALYSIS: normalizeEnvValue(process.env.OPENROUTER_API_KEY_ANALYSIS),
    OPENROUTER_API_KEY_ANALYSIS_COMPETENCIA: normalizeEnvValue(
      process.env.OPENROUTER_API_KEY_ANALYSIS_COMPETENCIA,
    ),
    OPENROUTER_API_KEY_TRANSCRIPTION: normalizeEnvValue(process.env.OPENROUTER_API_KEY_TRANSCRIPTION),
    OPENROUTER_BASE_URL: normalizeEnvValue(process.env.OPENROUTER_BASE_URL),
    OPENROUTER_ANALYSIS_MODEL: normalizeEnvValue(process.env.OPENROUTER_ANALYSIS_MODEL),
    OPENROUTER_ANALYSIS_COMPETENCIA_MODEL: normalizeEnvValue(
      process.env.OPENROUTER_ANALYSIS_COMPETENCIA_MODEL,
    ),
    OPENROUTER_TRANSCRIPTION_MODEL: normalizeEnvValue(process.env.OPENROUTER_TRANSCRIPTION_MODEL),
    LANGFUSE_PUBLIC_KEY: normalizeEnvValue(process.env.LANGFUSE_PUBLIC_KEY),
    LANGFUSE_SECRET_KEY: normalizeEnvValue(process.env.LANGFUSE_SECRET_KEY),
    LANGFUSE_BASE_URL: normalizeEnvValue(process.env.LANGFUSE_BASE_URL),
    LANGFUSE_ENABLED: normalizeEnvValue(process.env.LANGFUSE_ENABLED)?.toLowerCase(),
    LANGFUSE_DEBUG: normalizeEnvValue(process.env.LANGFUSE_DEBUG)?.toLowerCase(),
    APIFY_TOKEN: normalizeEnvValue(process.env.APIFY_TOKEN),
    APIFY_INSTAGRAM_ACTOR_ID: normalizeEnvValue(process.env.APIFY_INSTAGRAM_ACTOR_ID),
    OPUSCLIP_API_KEY: normalizeEnvValue(process.env.OPUSCLIP_API_KEY),
    OPUSCLIP_ORG_ID: normalizeEnvValue(process.env.OPUSCLIP_ORG_ID),
    OPUSCLIP_API_BASE_URL: normalizeEnvValue(process.env.OPUSCLIP_API_BASE_URL),
    INSTAGRAM_CLIENT_ID: normalizeEnvValue(process.env.INSTAGRAM_CLIENT_ID),
    INSTAGRAM_CLIENT_SECRET: normalizeEnvValue(process.env.INSTAGRAM_CLIENT_SECRET),
    INSTAGRAM_ACCESS_TOKEN: normalizeEnvValue(process.env.INSTAGRAM_ACCESS_TOKEN),
    INSTAGRAM_USER_ID: normalizeEnvValue(process.env.INSTAGRAM_USER_ID),
    INSTAGRAM_API_BASE_URL: normalizeEnvValue(process.env.INSTAGRAM_API_BASE_URL),
    INSTAGRAM_GRAPH_API_VERSION: normalizeEnvValue(process.env.INSTAGRAM_GRAPH_API_VERSION),
    TIKTOK_CLIENT_KEY: normalizeEnvValue(process.env.TIKTOK_CLIENT_KEY),
    TIKTOK_CLIENT_SECRET: normalizeEnvValue(process.env.TIKTOK_CLIENT_SECRET),
    YOUTUBE_CLIENT_ID: normalizeEnvValue(process.env.YOUTUBE_CLIENT_ID),
    YOUTUBE_CLIENT_SECRET: normalizeEnvValue(process.env.YOUTUBE_CLIENT_SECRET),
    SUPABASE_URL: normalizeEnvValue(process.env.SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY),
    NEXT_PUBLIC_SUPABASE_URL: normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    UPSTASH_REDIS_REST_URL: normalizeEnvValue(process.env.UPSTASH_REDIS_REST_URL),
    UPSTASH_REDIS_REST_TOKEN: normalizeEnvValue(process.env.UPSTASH_REDIS_REST_TOKEN),
    SKIP_AI_ANALYSIS_CONNECTIONS: normalizeEnvValue(process.env.SKIP_AI_ANALYSIS_CONNECTIONS),
  });
}

export const env = new Proxy({} as ReturnType<typeof getEnv>, {
  get(_target, property) {
    const current = getEnv();
    return current[property as keyof typeof current];
  },
});

export function getMissingEnvKeys() {
  const current = getEnv();
  const hasLegacyInstagram = Boolean(current.INSTAGRAM_ACCESS_TOKEN && current.INSTAGRAM_USER_ID);
  const hasOpenRouterAnalysisKey = Boolean(current.OPENROUTER_API_KEY_ANALYSIS || current.OPENROUTER_API_KEY);
  const hasOpenRouterTranscriptionKey = Boolean(
    current.OPENROUTER_API_KEY_TRANSCRIPTION || current.OPENROUTER_API_KEY,
  );

  return [
    !current.SUPABASE_URL && "SUPABASE_URL",
    !current.SUPABASE_SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
    !(current.CONNECTION_ENCRYPTION_SECRET || current.AUTH_SECRET || hasLegacyInstagram) &&
      "CONNECTION_ENCRYPTION_SECRET",
    !hasOpenRouterAnalysisKey && "OPENROUTER_API_KEY_ANALYSIS",
    !hasOpenRouterTranscriptionKey && "OPENROUTER_API_KEY_TRANSCRIPTION",
  ].filter(Boolean) as string[];
}

export function hasSupabaseConfig() {
  const current = getEnv();
  return Boolean(current.SUPABASE_URL && current.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasInstagramOAuthConfig() {
  const current = getEnv();
  return Boolean(current.INSTAGRAM_CLIENT_ID && current.INSTAGRAM_CLIENT_SECRET);
}

export function hasInstagramLegacyConfig() {
  const current = getEnv();
  return Boolean(current.INSTAGRAM_ACCESS_TOKEN && current.INSTAGRAM_USER_ID);
}

export function hasTikTokOAuthConfig() {
  const current = getEnv();
  return Boolean(current.TIKTOK_CLIENT_KEY && current.TIKTOK_CLIENT_SECRET);
}

export function hasYouTubeOAuthConfig() {
  const current = getEnv();
  return Boolean(current.YOUTUBE_CLIENT_ID && current.YOUTUBE_CLIENT_SECRET);
}

export function hasOpenRouterConfig() {
  const current = getEnv();
  return Boolean(
    (current.OPENROUTER_API_KEY_ANALYSIS || current.OPENROUTER_API_KEY) &&
      (current.OPENROUTER_API_KEY_TRANSCRIPTION || current.OPENROUTER_API_KEY),
  );
}

export function hasOpenRouterAnalysisConfig() {
  const current = getEnv();
  return Boolean(current.OPENROUTER_API_KEY_ANALYSIS || current.OPENROUTER_API_KEY);
}

export function hasOpenRouterCompetitionAnalysisConfig() {
  const current = getEnv();
  return Boolean(
    current.OPENROUTER_API_KEY_ANALYSIS_COMPETENCIA ||
      current.OPENROUTER_API_KEY_ANALYSIS ||
      current.OPENROUTER_API_KEY,
  );
}

export function hasApifyCompetitionConfig() {
  const current = getEnv();
  return Boolean(current.APIFY_TOKEN && current.APIFY_INSTAGRAM_ACTOR_ID);
}

export function getCompetitionMissingEnvKeys() {
  const current = getEnv();

  return [
    !current.SUPABASE_URL && "SUPABASE_URL",
    !current.SUPABASE_SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
    !current.APIFY_TOKEN && "APIFY_TOKEN",
    !current.APIFY_INSTAGRAM_ACTOR_ID && "APIFY_INSTAGRAM_ACTOR_ID",
    !hasOpenRouterCompetitionAnalysisConfig() && "OPENROUTER_API_KEY_ANALYSIS_COMPETENCIA",
  ].filter(Boolean) as string[];
}

export function hasOpusClipConfig() {
  return Boolean(getEnv().OPUSCLIP_API_KEY);
}

export function getAutomationMissingEnvKeys() {
  const current = getEnv();

  return [
    !current.SUPABASE_URL && "SUPABASE_URL",
    !current.SUPABASE_SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
    !current.OPUSCLIP_API_KEY && "OPUSCLIP_API_KEY",
  ].filter(Boolean) as string[];
}

export function getSuperAssistantMissingEnvKeys() {
  const current = getEnv();
  const hasOpenRouterAnalysisKey = Boolean(
    current.OPENROUTER_API_KEY_ANALYSIS_COMPETENCIA ||
      current.OPENROUTER_API_KEY_ANALYSIS ||
      current.OPENROUTER_API_KEY,
  );
  const hasOpenRouterTranscriptionKey = Boolean(
    current.OPENROUTER_API_KEY_TRANSCRIPTION || current.OPENROUTER_API_KEY,
  );

  return [
    !current.SUPABASE_URL && "SUPABASE_URL",
    !current.SUPABASE_SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
    !current.APIFY_TOKEN && "APIFY_TOKEN",
    !current.APIFY_INSTAGRAM_ACTOR_ID && "APIFY_INSTAGRAM_ACTOR_ID",
    !hasOpenRouterAnalysisKey && "OPENROUTER_API_KEY_ANALYSIS_COMPETENCIA",
    !hasOpenRouterTranscriptionKey && "OPENROUTER_API_KEY_TRANSCRIPTION",
  ].filter(Boolean) as string[];
}

export function isAIAnalysisSkippedForConnection(connectionId: string) {
  const raw = getEnv().SKIP_AI_ANALYSIS_CONNECTIONS;
  if (!raw) return false;
  return raw.split(",").map((id) => id.trim()).includes(connectionId);
}

export function hasConnectionCryptoConfig() {
  const current = getEnv();
  return Boolean(current.CONNECTION_ENCRYPTION_SECRET || current.AUTH_SECRET);
}

export function getPlatformOAuthMissingKeys(platform: Platform) {
  const current = getEnv();

  switch (platform) {
    case "instagram":
      return [
        !current.INSTAGRAM_CLIENT_ID && "INSTAGRAM_CLIENT_ID",
        !current.INSTAGRAM_CLIENT_SECRET && "INSTAGRAM_CLIENT_SECRET",
        !(current.CONNECTION_ENCRYPTION_SECRET || current.AUTH_SECRET) &&
          "CONNECTION_ENCRYPTION_SECRET",
      ].filter(Boolean) as string[];
    case "tiktok":
      return [
        !current.TIKTOK_CLIENT_KEY && "TIKTOK_CLIENT_KEY",
        !current.TIKTOK_CLIENT_SECRET && "TIKTOK_CLIENT_SECRET",
        !(current.CONNECTION_ENCRYPTION_SECRET || current.AUTH_SECRET) &&
          "CONNECTION_ENCRYPTION_SECRET",
      ].filter(Boolean) as string[];
    case "youtube":
      return [
        !current.YOUTUBE_CLIENT_ID && "YOUTUBE_CLIENT_ID",
        !current.YOUTUBE_CLIENT_SECRET && "YOUTUBE_CLIENT_SECRET",
        !(current.CONNECTION_ENCRYPTION_SECRET || current.AUTH_SECRET) &&
          "CONNECTION_ENCRYPTION_SECRET",
      ].filter(Boolean) as string[];
    default:
      return [];
  }
}

export function requireEnvValue<Key extends keyof typeof env>(key: Key) {
  const current = getEnv();
  const value = current[key];

  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
}
