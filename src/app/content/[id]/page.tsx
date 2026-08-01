import { AIAnalysisCard } from "@/components/ai-analysis-card";
import { AnalyzeContentButton } from "@/components/analyze-content-button";
import { ContentPreview } from "@/components/content-preview";
import { ContentStatCard } from "@/components/content-stat-card";
import { ReelTranscriptionCard } from "@/components/reel-transcription-card";
import { YouTubePreview } from "@/components/youtube-preview";
import {
  buildMainMetricCards,
  buildSecondaryMetricGroups,
} from "@/lib/content-detail-metrics";
import { formatCompactNumber, formatDateTime } from "@/lib/format";
import { isAnalysisProcessingStale } from "@/lib/content-analysis-agent";
import { getContentKind, getContentPreviewAssets, getTranscriptTextAsset, isVideoEligibleForTranscript } from "@/lib/content-media";
import { getPlatformLabel } from "@/lib/platforms";
import { requireAllowedPageUser } from "@/lib/server-auth";
import { getContentDetail } from "@/lib/supabase/repository";
import { getYouTubeEmbedUrl } from "@/lib/youtube-embed";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

function getAnalysisError(rawPayload: Record<string, unknown>) {
  const analysisError = rawPayload.analysisError;
  if (!analysisError || typeof analysisError !== "object") {
    return null;
  }

  const message = (analysisError as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message : null;
}

export default async function ContentDetailPage({ params }: PageProps) {
  await requireAllowedPageUser();

  const { id } = await params;
  const detail = await getContentDetail(id);

  if (!detail) {
    notFound();
  }

  const latestSnapshot = detail.snapshots[0] ?? null;
  const mergedMetrics = latestSnapshot?.metrics ?? {};
  const mainMetricCards = buildMainMetricCards(mergedMetrics);
  const secondaryMetricGroups = buildSecondaryMetricGroups(mergedMetrics);
  const previewAssets = getContentPreviewAssets(detail.item);
  const contentKind = getContentKind(detail.item.platform, detail.item.rawPayload);
  const displayTitle =
    detail.item.title ?? detail.item.caption?.slice(0, 100) ?? "Contenido sin titulo";
  const transcriptAsset = getTranscriptTextAsset(detail.textAssets);
  const isTranscriptionEligible = isVideoEligibleForTranscript(detail.item);
  const isYouTube = detail.item.platform === "youtube";
  const youTubeEmbedUrl = isYouTube ? getYouTubeEmbedUrl(detail.item.externalId) : null;
  const transcriptModel =
    detail.item.transcriptionModel ??
    (typeof transcriptAsset?.rawPayload?.model === "string" ? transcriptAsset.rawPayload?.model : null);
  const transcriptGeneratedAt =
    detail.item.transcriptionUpdatedAt ?? transcriptAsset?.updatedAt ?? null;
  const analysisError = getAnalysisError(detail.item.rawPayload);

  return (
    <div className="space-y-4 py-1">
      <section className="ds-animate-in rounded-lg border border-border bg-card p-5 shadow-float sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 flex-1 gap-4">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  href="/content"
                  className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground transition hover:text-foreground"
                >
                  <ArrowLeft className="size-3.5" />
                  Biblioteca
                </Link>
                <span className="font-mono text-micro uppercase tracking-caps text-muted-foreground">
                  {getPlatformLabel(detail.item.platform)}
                </span>
                <span className="rounded-full border border-line bg-surface-elevated px-2 py-1 text-label uppercase tracking-caps text-muted-foreground">
                  {contentKind}
                </span>
              </div>

              <h1 className="text-[1.5rem] font-semibold tracking-display text-foreground sm:text-[1.9rem]">
                {displayTitle}
              </h1>
              <p className="text-body-sm text-muted-foreground">
                Publicado el {formatDateTime(detail.item.publishedAt)}
              </p>
            </div>
          </div>

          {detail.item.permalink ? (
            <a
              href={detail.item.permalink}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-sm border border-line px-4 py-2 text-body text-muted-foreground transition hover:border-line-strong hover:text-foreground"
            >
              <span className="inline-flex items-center gap-2">
                Ver original
                <ExternalLink className="size-3.5" />
              </span>
            </a>
          ) : null}
        </div>
      </section>

      <div className="space-y-8">
        {/* Metricas principales */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            <p className="font-mono text-label uppercase tracking-caps text-muted-foreground">
              Metricas principales
            </p>
          </div>
          <div
            className="grid w-full overflow-hidden rounded-lg border border-border bg-card shadow-float"
            style={{ gridTemplateColumns: `repeat(${mainMetricCards.length}, minmax(0, 1fr))` }}
          >
            {mainMetricCards.map((metric, i) => (
              <ContentStatCard
                key={metric.key}
                label={metric.label}
                value={formatCompactNumber(metric.value)}
                metricKey={metric.key}
                index={i}
              />
            ))}
          </div>
        </div>

        {/* Analisis secundario */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            <p className="font-mono text-label uppercase tracking-caps text-muted-foreground">
              Analisis secundario
            </p>
          </div>

          {secondaryMetricGroups.length === 0 ? (
            <p className="text-body text-muted-foreground">Sin metricas almacenadas.</p>
          ) : (
            (() => {
              const secondaryCards = secondaryMetricGroups.flatMap((group) => group.cards);
              return (
                <div
                  className="grid w-full overflow-hidden rounded-lg border border-border bg-card shadow-float"
                  style={{ gridTemplateColumns: `repeat(${secondaryCards.length}, minmax(0, 1fr))` }}
                >
                  {secondaryCards.map((card, i) => (
                    <ContentStatCard
                      key={card.key}
                      label={card.label}
                      value={card.formattedValue}
                      metricKey={card.key}
                      index={i}
                    />
                  ))}
                </div>
              );
            })()
          )}
        </div>
      </div>

      <section className="ds-animate-in ds-delay-1 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <article className="rounded-lg border border-border bg-card p-5 shadow-float sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-label uppercase tracking-caps text-muted-foreground">
                Contenido
              </p>
              <p className="mt-2 text-[1.1rem] font-semibold tracking-display text-foreground">
                {isYouTube ? "Vista del video" : "Vista del reel"}
              </p>
            </div>
            <span className="text-body-sm text-muted-foreground">
              {previewAssets.length} {previewAssets.length === 1 ? "asset" : "assets"}
            </span>
          </div>
          {youTubeEmbedUrl ? (
            <YouTubePreview
              embedUrl={youTubeEmbedUrl}
              thumbnailUrl={detail.item.thumbnailUrl}
              title={displayTitle}
            />
          ) : (
            <ContentPreview
              assets={previewAssets}
              title={displayTitle}
              variant={isYouTube ? "default" : "portrait"}
              layout={contentKind === "Carrusel" ? "carousel" : "grid"}
            />
          )}
        </article>

        <div className="space-y-8">
          <AIAnalysisCard
            insight={detail.insight}
            status={detail.item.analysisStatus}
            updatedAt={detail.insight?.updatedAt ?? detail.item.updatedAt}
            error={analysisError}
            action={
              <AnalyzeContentButton
                contentId={detail.item.id}
                status={detail.item.analysisStatus}
                canRetryProcessing={isAnalysisProcessingStale(detail.item)}
              />
            }
          />
          <ReelTranscriptionCard
            eligible={isTranscriptionEligible}
            status={detail.item.transcriptionStatus}
            model={transcriptModel}
            updatedAt={transcriptGeneratedAt}
            transcript={transcriptAsset?.content ?? null}
            error={detail.item.transcriptionError}
          />
        </div>
      </section>
    </div>
  );
}
