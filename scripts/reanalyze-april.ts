/**
 * Reanaliza con IA todos los items publicados desde abril 2026
 * con analysis_status = 'failed' o 'pending'.
 *
 * Uso: npx tsx --tsconfig tsconfig.json scripts/reanalyze-april.ts
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

function loadLocalEnvFiles() {
  const cwd = process.cwd();
  for (const envFile of [".env.local", ".env"]) {
    const filePath = join(cwd, envFile);
    if (existsSync(filePath)) {
      process.loadEnvFile(filePath);
    }
  }
}

loadLocalEnvFiles();

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { toContentItem, toTextAsset } from "@/lib/supabase/mappers";
import {
  chooseAnalysisInput,
  generateEmbedding,
  generateInsight,
  transcribeRemoteMedia,
} from "@/lib/ai/analysis";
import { env } from "@/lib/env";
import {
  getPlatformConnectionBrief,
} from "@/lib/supabase/repository";
import {
  setAnalysisState,
  upsertEmbedding,
  upsertInsight,
  upsertTextAsset,
} from "@/lib/supabase/repository";
import { flushLangfuse, shutdownLangfuse, withLangfuseTrace } from "@/lib/observability/langfuse";
import type { ContentItem, TextAsset } from "@/lib/types";
import type { ContentRow, TextAssetRow } from "@/lib/supabase/types";

const SINCE = "2026-04-01T00:00:00.000Z";
const DELAY_BETWEEN_ITEMS_MS = 120000; // 2 min entre items
const RATE_LIMIT_WAIT_MS = 90000;      // 90s de espera cuando hay rate limit

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isRetryableAIError(error: unknown) {
  const msg = getErrorMessage(error);
  return (
    msg.includes('"status":"RESOURCE_EXHAUSTED"') ||
    msg.includes('"status":"UNAVAILABLE"') ||
    msg.includes('"code":429') ||
    msg.includes('"code":503')
  );
}

function isEmbeddingDimensionError(error: unknown) {
  return /expected\s+\d+\s+dimensions/iu.test(getErrorMessage(error));
}

async function fetchItemsToReanalyze(): Promise<ContentItem[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("content_items")
    .select("*")
    .gte("published_at", SINCE)
    .in("analysis_status", ["failed", "pending"])
    .order("published_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toContentItem(row as ContentRow));
}

async function fetchTextAssets(contentItemId: string): Promise<TextAsset[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("content_text_assets")
    .select("*")
    .eq("content_item_id", contentItemId);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toTextAsset(row as TextAssetRow));
}

async function analyzeItem(item: ContentItem, embeddingsEnabled: { value: boolean }) {
  const textAssets = await fetchTextAssets(item.id);

  const brief = item.connectionId
    ? await getPlatformConnectionBrief(item.connectionId)
    : undefined;

  const briefFields = brief
    ? {
        offer: brief.offer,
        idealCustomerProfile: brief.idealCustomerProfile,
        corePain: brief.corePain,
        desiredOutcome: brief.desiredOutcome,
        differentiator: brief.differentiator,
        toneGuidelines: brief.toneGuidelines,
        avoidGuidelines: brief.avoidGuidelines,
        primaryCta: brief.primaryCta,
        notes: brief.notes,
      }
    : {
        offer: "",
        idealCustomerProfile: "",
        corePain: "",
        desiredOutcome: "",
        differentiator: "",
        toneGuidelines: "",
        avoidGuidelines: "",
        primaryCta: "",
        notes: "",
      };

  // Si no hay caption/texto, intentar transcribir el video
  const hasPrimaryCaption = textAssets.some(
    (a) =>
      (a.sourceType === "official_caption" || a.sourceType === "platform_caption") &&
      a.content.trim(),
  );

  if (!hasPrimaryCaption && item.mediaUrl) {
    try {
      const transcript = await transcribeRemoteMedia(item.mediaUrl);
      if (transcript) {
        await upsertTextAsset(item.id, "transcript", transcript, "es");
        textAssets.push({
          id: `${item.id}-transcript`,
          contentItemId: item.id,
          sourceType: "transcript",
          content: transcript,
          language: "es",
          rawPayload: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      if (isRetryableAIError(err)) throw err; // propagar para detener el loop
      console.warn(`  ⚠ No se pudo transcribir: ${getErrorMessage(err)}`);
    }
  }

  const analysisInput = chooseAnalysisInput(item, textAssets);

  if (analysisInput.sourceType === "metadata_fallback") {
    await upsertTextAsset(item.id, "metadata_fallback", analysisInput.content, "es");
  }

  const insight = await generateInsight(item, analysisInput, briefFields);

  await upsertInsight(item.id, {
    ...insight,
    model: env.OPENROUTER_ANALYSIS_MODEL,
  });

  if (embeddingsEnabled.value) {
    try {
      const embedding = await generateEmbedding(analysisInput.content);
      if (embedding.length > 0) {
        await upsertEmbedding(item.id, embedding, "gemini-embedding", analysisInput.content);
      }
    } catch (err) {
      if (isEmbeddingDimensionError(err)) {
        embeddingsEnabled.value = false;
        console.warn(`  ⚠ Embeddings desactivados: ${getErrorMessage(err)}`);
      } else {
        console.warn(`  ⚠ No se pudo guardar embedding: ${getErrorMessage(err)}`);
      }
    }
  }

  const finalStatus =
    analysisInput.sourceType === "metadata_fallback" || insight.evidenceMode === "text_only"
      ? "fallback"
      : "ready";

  await setAnalysisState(item.id, {
    analysisStatus: finalStatus,
    analysisInputText: analysisInput.content,
    rawPayload: { ...item.rawPayload, analysisError: null },
  });

  return finalStatus;
}

async function runReanalysis() {
  console.log(`\nReanalisis de contenido desde abril 2026`);
  console.log(`──────────────────────────────────────────\n`);

  const items = await fetchItemsToReanalyze();

  if (items.length === 0) {
    console.log("No hay items con status 'failed' o 'pending' desde abril. Nada que hacer.");
    return;
  }

  console.log(`Items a analizar: ${items.length}\n`);

  let ok = 0;
  let fallback = 0;
  let failed = 0;
  const embeddingsEnabled = { value: true };

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const label = item.title ?? item.caption?.slice(0, 60) ?? item.externalId;
    const prefix = `[${i + 1}/${items.length}] ${item.platform.toUpperCase()}`;
    process.stdout.write(`${prefix} — ${label}... `);

    let attempts = 0;
    let done = false;

    while (!done) {
      try {
        const status = await analyzeItem(item, embeddingsEnabled);
        if (status === "ready") {
          ok += 1;
          console.log("✓ ready");
        } else {
          fallback += 1;
          console.log("~ fallback");
        }
        done = true;
      } catch (err) {
        if (isRetryableAIError(err) && attempts < 3) {
          attempts += 1;
          console.log(`\n  ⏳ Rate limit: ${getErrorMessage(err).slice(0, 200)}`);
          console.log(`  Esperando ${RATE_LIMIT_WAIT_MS / 1000}s antes de reintentar (intento ${attempts}/3)...`);
          await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_WAIT_MS));
          process.stdout.write(`  Reintentando [${i + 1}/${items.length}]... `);
          continue;
        }

        if (isRetryableAIError(err)) {
          console.log(`\n⛔ Rate limit persistente. Deteniéndose. Progreso: ${ok + fallback}/${items.length}.\n`);
          process.exit(1);
        }

        failed += 1;
        console.log(`✗ error: ${getErrorMessage(err)}`);
        await setAnalysisState(item.id, {
          analysisStatus: "failed",
          rawPayload: {
            ...item.rawPayload,
            analysisError: { message: getErrorMessage(err), at: new Date().toISOString() },
          },
        }).catch(() => undefined);
        done = true;
      }
    }

    // Pausa entre items para evitar rate limit del proveedor de IA
    if (i < items.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_ITEMS_MS));
    }
  }

  console.log(`\n──────────────────────────────────────────`);
  console.log(`Listo: ${ok} ready · ${fallback} fallback · ${failed} fallidos`);
  console.log(`──────────────────────────────────────────\n`);
}

async function main() {
  return withLangfuseTrace(
    {
      name: "content.reanalyze_april",
      input: { since: SINCE },
      metadata: { agentType: "content_analysis", since: SINCE },
      tags: ["agent:content_analysis", "feature:reanalyze"],
    },
    runReanalysis,
  );
}

main().catch((err) => {
  console.error("\n" + getErrorMessage(err));
  process.exitCode = 1;
}).finally(async () => {
  await flushLangfuse();
  await shutdownLangfuse();
});
