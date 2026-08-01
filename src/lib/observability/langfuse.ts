import { LangfuseSpanProcessor } from "@langfuse/otel";
import {
  propagateAttributes,
  startActiveObservation,
  type LangfuseGenerationAttributes,
  type LangfuseSpanAttributes,
} from "@langfuse/tracing";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { env } from "@/lib/env";

type LangfuseTraceOptions<T> = {
  name: string;
  input?: unknown;
  output?: (result: T) => unknown;
  metadata?: Record<string, unknown>;
  tags?: string[];
  sessionId?: string | null;
  userId?: string | null;
  version?: string | null;
};

type LangfuseSpanOptions<T> = {
  name: string;
  input?: unknown;
  output?: (result: T) => unknown;
  metadata?: Record<string, unknown>;
};

type LangfuseUsageInput = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  inputCostUsd?: number | null;
  outputCostUsd?: number | null;
  totalCostUsd?: number | null;
} | null | undefined;

type LangfuseGenerationOptions<T> = LangfuseSpanOptions<T> & {
  model?: string | null;
  modelParameters?: Record<string, string | number>;
  usage?: (result: T) => LangfuseUsageInput;
};

const MAX_STRING_LENGTH = 6_000;
const MAX_ARRAY_ITEMS = 30;
const MAX_OBJECT_KEYS = 60;
const REDACTED = "[redacted]";
const SENSITIVE_KEY_PATTERN =
  /api[_-]?key|authorization|bearer|cookie|password|secret|service[_-]?role|token|access[_-]?token|refresh[_-]?token|client[_-]?secret/i;
const URL_KEY_PATTERN = /^(mediaUrl|thumbnailUrl|profileImageUrl|imageUrl|videoUrl|audioUrl|url|sourceUrl)$/i;
const MODEL_COSTS_USD_PER_MILLION: Record<string, { input: number; output: number }> = {
  "openai/gpt-5-mini": { input: 0.25, output: 2 },
  "x-ai/grok-4.1-fast": { input: 0.2, output: 0.5 },
  "anthropic/claude-sonnet-4.6": { input: 3, output: 15 },
};

let sdk: NodeSDK | null = null;
let processor: LangfuseSpanProcessor | null = null;
let started = false;
let failedToStart = false;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function normalizeEnvironment(value: string | undefined) {
  const normalized = (value ?? "development")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized || normalized.startsWith("langfuse")) {
    return "development";
  }

  return normalized.slice(0, 50);
}

function getRelease() {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    process.env.npm_package_version ??
    undefined
  );
}

export function isLangfuseEnabled() {
  const current = env;
  return Boolean(
    current.LANGFUSE_ENABLED !== "false" &&
      current.LANGFUSE_PUBLIC_KEY &&
      current.LANGFUSE_SECRET_KEY,
  );
}

function isLangfuseDebugEnabled() {
  return env.LANGFUSE_DEBUG === "true";
}

function getMissingLangfuseKeys() {
  const current = env;
  return [
    !current.LANGFUSE_PUBLIC_KEY && "LANGFUSE_PUBLIC_KEY",
    !current.LANGFUSE_SECRET_KEY && "LANGFUSE_SECRET_KEY",
  ].filter(Boolean) as string[];
}

export function getLangfuseStatus() {
  const missingKeys = getMissingLangfuseKeys();

  return {
    enabled: isLangfuseEnabled(),
    started,
    failedToStart,
    missingKeys,
    baseUrl: env.LANGFUSE_BASE_URL,
    debug: isLangfuseDebugEnabled(),
  };
}

function maskString(value: string, maxLength = MAX_STRING_LENGTH) {
  const masked = value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer " + REDACTED)
    .replace(/\b(sk|pk)-[A-Za-z0-9][A-Za-z0-9_-]{12,}\b/g, "$1-" + REDACTED)
    .replace(
      /(api[_-]?key|token|secret|password|access[_-]?token|refresh[_-]?token)=([^&\s]+)/gi,
      "$1=" + REDACTED,
    )
    .replace(/data:[^;]+;base64,[A-Za-z0-9+/=]+/g, "data:" + REDACTED);

  if (masked.length <= maxLength) {
    return masked;
  }

  return masked.slice(0, maxLength).trimEnd() + `... [truncated ${masked.length - maxLength} chars]`;
}

function sanitizeRecord(
  value: Record<string, unknown>,
  depth: number,
  maxStringLength: number,
): Record<string, unknown> {
  const entries = Object.entries(value).slice(0, MAX_OBJECT_KEYS);
  const sanitized: Record<string, unknown> = {};

  for (const [key, entryValue] of entries) {
    if (
      SENSITIVE_KEY_PATTERN.test(key) ||
      URL_KEY_PATTERN.test(key) ||
      key === "rawPayload" ||
      key === "dataset"
    ) {
      sanitized[key] = REDACTED;
      continue;
    }

    sanitized[key] = sanitizeForLangfuse(entryValue, {
      depth: depth + 1,
      maxStringLength,
    });
  }

  if (Object.keys(value).length > entries.length) {
    sanitized.__truncatedKeys = Object.keys(value).length - entries.length;
  }

  return sanitized;
}

export function sanitizeForLangfuse(
  value: unknown,
  options: { depth?: number; maxStringLength?: number } = {},
): unknown {
  const depth = options.depth ?? 0;
  const maxStringLength = options.maxStringLength ?? MAX_STRING_LENGTH;

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return maskString(value, maxStringLength);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (depth >= 6) {
    return "[max-depth]";
  }

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeForLangfuse(item, { depth: depth + 1, maxStringLength }));

    if (value.length > items.length) {
      items.push(`[truncated ${value.length - items.length} items]`);
    }

    return items;
  }

  if (typeof value === "object") {
    return sanitizeRecord(value as Record<string, unknown>, depth, maxStringLength);
  }

  return String(value);
}

function toPropagationMetadata(metadata: Record<string, unknown> | undefined) {
  if (!metadata) {
    return undefined;
  }

  const sanitized = sanitizeForLangfuse(metadata, { maxStringLength: 180 });
  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(sanitized as Record<string, unknown>)
      .map(([key, value]) => [key.slice(0, 180), String(value).slice(0, 180)])
      .filter(([key, value]) => key && value),
  );
}

function toLangfuseUsageDetails(usage: LangfuseUsageInput) {
  if (!usage) {
    return undefined;
  }

  const details: Record<string, number> = {};

  if (typeof usage.inputTokens === "number") {
    details.input = usage.inputTokens;
  }

  if (typeof usage.outputTokens === "number") {
    details.output = usage.outputTokens;
  }

  if (typeof usage.totalTokens === "number") {
    details.total = usage.totalTokens;
  }

  return Object.keys(details).length > 0 ? details : undefined;
}

function normalizeModelForCost(model: string | null | undefined) {
  return model?.trim().toLowerCase() ?? "";
}

export function estimateLangfuseCostDetails(usage: LangfuseUsageInput, model?: string | null) {
  if (!usage) {
    return undefined;
  }

  const explicitDetails: Record<string, number> = {};

  if (typeof usage.inputCostUsd === "number") {
    explicitDetails.input = usage.inputCostUsd;
  }

  if (typeof usage.outputCostUsd === "number") {
    explicitDetails.output = usage.outputCostUsd;
  }

  if (typeof usage.totalCostUsd === "number") {
    explicitDetails.total = usage.totalCostUsd;
  }

  if (Object.keys(explicitDetails).length > 0) {
    if (typeof explicitDetails.total !== "number") {
      explicitDetails.total = (explicitDetails.input ?? 0) + (explicitDetails.output ?? 0);
    }

    return explicitDetails;
  }

  const rates = MODEL_COSTS_USD_PER_MILLION[normalizeModelForCost(model)];

  if (!rates || typeof usage.inputTokens !== "number" || typeof usage.outputTokens !== "number") {
    return undefined;
  }

  const input = (usage.inputTokens / 1_000_000) * rates.input;
  const output = (usage.outputTokens / 1_000_000) * rates.output;

  return {
    input,
    output,
    total: input + output,
  };
}

function markObservationError(observation: { update: (attributes: LangfuseSpanAttributes) => unknown }, error: unknown) {
  observation.update({
    level: "ERROR",
    statusMessage: getErrorMessage(error),
    output: { error: getErrorMessage(error) },
  });
}

export function ensureLangfuseStarted() {
  if (started) {
    return true;
  }

  if (failedToStart || typeof window !== "undefined") {
    return false;
  }

  if (!isLangfuseEnabled()) {
    if (isLangfuseDebugEnabled()) {
      console.warn("[langfuse] tracing disabled: missing " + getMissingLangfuseKeys().join(", "));
    }
    return false;
  }

  try {
    processor = new LangfuseSpanProcessor({
      publicKey: env.LANGFUSE_PUBLIC_KEY,
      secretKey: env.LANGFUSE_SECRET_KEY,
      baseUrl: env.LANGFUSE_BASE_URL,
      environment: normalizeEnvironment(process.env.VERCEL_ENV ?? process.env.NODE_ENV),
      release: getRelease(),
      mask: ({ data }) => sanitizeForLangfuse(data, { maxStringLength: 8_000 }),
    });
    sdk = new NodeSDK({
      serviceName: "contentos",
      spanProcessors: [processor],
    });
    sdk.start();
    started = true;
    return true;
  } catch (error) {
    failedToStart = true;
    console.warn("[langfuse] tracing disabled:", getErrorMessage(error));
    return false;
  }
}

export async function flushLangfuse() {
  if (!started || !processor) {
    if (isLangfuseDebugEnabled()) {
      console.warn("[langfuse] flush skipped: tracing is not started.");
    }
    return;
  }

  await processor.forceFlush().catch((error) => {
    if (isLangfuseDebugEnabled()) {
      console.warn("[langfuse] flush failed:", getErrorMessage(error));
    }
  });
}

export async function shutdownLangfuse() {
  if (!started || !sdk) {
    return;
  }

  await sdk.shutdown().catch(() => undefined);
  started = false;
  sdk = null;
  processor = null;
}

export async function withLangfuseTrace<T>(
  options: LangfuseTraceOptions<T>,
  fn: () => Promise<T>,
): Promise<T> {
  if (!ensureLangfuseStarted()) {
    return fn();
  }

  return startActiveObservation(options.name, async (span) =>
    propagateAttributes(
      {
        traceName: options.name,
        sessionId: options.sessionId ?? undefined,
        userId: options.userId ?? undefined,
        tags: options.tags,
        version: options.version ?? undefined,
        metadata: toPropagationMetadata(options.metadata),
      },
      async () => {
        span.update({
          input: sanitizeForLangfuse(options.input),
          metadata: sanitizeForLangfuse(options.metadata) as Record<string, unknown>,
          version: options.version ?? undefined,
        });

        try {
          const result = await fn();
          if (options.output) {
            span.update({ output: sanitizeForLangfuse(options.output(result)) });
          }
          return result;
        } catch (error) {
          markObservationError(span, error);
          throw error;
        }
      },
    ),
  );
}

export async function withLangfuseSpan<T>(
  options: LangfuseSpanOptions<T>,
  fn: () => Promise<T>,
): Promise<T> {
  if (!ensureLangfuseStarted()) {
    return fn();
  }

  return startActiveObservation(options.name, async (span) => {
    span.update({
      input: sanitizeForLangfuse(options.input),
      metadata: sanitizeForLangfuse(options.metadata) as Record<string, unknown>,
    });

    try {
      const result = await fn();
      if (options.output) {
        span.update({ output: sanitizeForLangfuse(options.output(result)) });
      }
      return result;
    } catch (error) {
      markObservationError(span, error);
      throw error;
    }
  });
}

export async function withLangfuseGeneration<T>(
  options: LangfuseGenerationOptions<T>,
  fn: () => Promise<T>,
): Promise<T> {
  if (!ensureLangfuseStarted()) {
    return fn();
  }

  return startActiveObservation(
    options.name,
    async (generation) => {
      generation.update({
        input: sanitizeForLangfuse(options.input),
        metadata: sanitizeForLangfuse(options.metadata) as Record<string, unknown>,
        model: options.model ?? undefined,
        modelParameters: options.modelParameters,
      });

      try {
        const result = await fn();
        const update: LangfuseGenerationAttributes = {};
        const usage = options.usage?.(result);
        const usageDetails = toLangfuseUsageDetails(usage);
        const costDetails = estimateLangfuseCostDetails(usage, options.model);

        if (options.output) {
          update.output = sanitizeForLangfuse(options.output(result));
        }

        if (usageDetails) {
          update.usageDetails = usageDetails;
        }

        if (costDetails) {
          update.costDetails = costDetails;
        }

        if (Object.keys(update).length > 0) {
          generation.update(update);
        }

        return result;
      } catch (error) {
        generation.update({
          level: "ERROR",
          statusMessage: getErrorMessage(error),
          output: { error: getErrorMessage(error) },
        });
        throw error;
      }
    },
    { asType: "generation" },
  );
}
