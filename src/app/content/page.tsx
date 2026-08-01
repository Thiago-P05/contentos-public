import {
  BrainCircuit,
  Eye,
  MessageCircle,
  Play,
} from "lucide-react";
import type * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SetupChecklist } from "@/components/setup-checklist";
import { AnalyzeContentButton } from "@/components/analyze-content-button";
import {
  getLibraryItemComments as getItemComments,
  getLibraryItemEngagementRate as getItemEngagement,
  getLibraryItemReach as getItemReach,
  getLibraryItemViews as getItemViews,
} from "@/lib/content-library-metrics";
import { getMissingEnvKeys, hasInstagramLegacyConfig, hasSupabaseConfig } from "@/lib/env";
import { formatCompactNumber, formatDateOnly } from "@/lib/format";
import { getContentKind } from "@/lib/content-media";
import { isAnalysisProcessingStale } from "@/lib/content-analysis-agent";
import { createServerTimer } from "@/lib/perf/server-timing";
import { normalizePlatformFilter, PLATFORM_OPTIONS } from "@/lib/platforms";
import { resolvePreferredConnectionId } from "@/lib/preferred-connection";
import { requireAllowedPageUser } from "@/lib/server-auth";
import { listContentLibrary, listPlatformConnections } from "@/lib/supabase/repository";
import type { AnalysisStatus, PlatformFilter } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Oversample for in-memory section filters; UI shows 18 cards. */
const CONTENT_LIBRARY_FETCH_LIMIT = 60;
const CONTENT_LIBRARY_VISIBLE = 18;

type PageProps = {
  searchParams: Promise<{
    section?: string;
    platform?: string;
    connection?: string;
    q?: string;
    sort?: string;
  }>;
};

const SECTION_TABS = [
  { label: "Todos", section: "all" as const },
  { label: "Reels", section: "reels" as const },
  { label: "Videos", section: "videos" as const },
  { label: "Historias", section: "stories" as const },
  { label: "Carruseles", section: "carousel" as const },
] as const;


function normalizeSection(value: string | undefined): "all" | "reels" | "videos" | "stories" | "carousel" {
  if (value === "all" || value === "videos" || value === "stories" || value === "carousel") {
    return value;
  }
  if (value === "reels") {
    return value;
  }
  return "all";
}

function normalizePlatform(value: string | undefined): PlatformFilter {
  if (!value) return "instagram";
  const normalized = normalizePlatformFilter(value);
  return normalized === "all" && value !== "all" ? "instagram" : normalized;
}

function normalizeSort(value: string | undefined) {
  return value === "top" ? "top" : "recent";
}

function getContentHref({
  section,
  platform,
  connectionId,
  query,
  sort,
}: {
  section: "all" | "reels" | "videos" | "stories" | "carousel";
  platform: PlatformFilter;
  connectionId: string | null;
  query: string;
  sort: "recent" | "top";
}) {
  const params = new URLSearchParams();

  if (section !== "all") {
    params.set("section", section);
  }

  if (platform !== "instagram") {
    params.set("platform", platform);
  }

  if (connectionId && connectionId !== "all") {
    params.set("connection", connectionId);
  }

  if (query.trim()) {
    params.set("q", query.trim());
  }

  if (sort !== "recent") {
    params.set("sort", sort);
  }

  const queryString = params.toString();
  return queryString ? `/content?${queryString}` : "/content";
}

function getFilterLinkClass(isActive: boolean) {
  return [
    "relative inline-flex items-center gap-1.5 pb-1 text-caption font-medium transition-colors",
    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
  ].join(" ");
}

function ActiveUnderline() {
  return <span className="absolute inset-x-0 bottom-0 h-px bg-foreground" />;
}


function getPublishedAgeLabel(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const hours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));
  if (hours < 24) return `de ${hours} horas`;
  const days = Math.floor(hours / 24);
  return `de ${days} dias`;
}

function getAnalysisStatusLabel(status: AnalysisStatus, hasInsight: boolean) {
  if (hasInsight && status === "ready") return "Analizado";
  if (hasInsight && status === "fallback") return "Fallback";

  switch (status) {
    case "ready":
      return "Analizado";
    case "fallback":
      return "Fallback";
    case "processing":
      return "Procesando";
    case "failed":
      return "Fallo";
    default:
      return "Pendiente";
  }
}

function getAnalysisStatusVariant(
  status: AnalysisStatus,
  hasInsight: boolean,
): React.ComponentProps<typeof Badge>["variant"] {
  if (status === "fallback") return "warning";
  if (hasInsight || status === "ready") return "success";
  if (status === "failed") return "destructive";
  return "secondary";
}


export default async function ContentPage({ searchParams }: PageProps) {
  const timer = createServerTimer("content");

  await timer.timeAsync("auth", () => requireAllowedPageUser());

  const params = await searchParams;
  const selectedSection = normalizeSection(params.section);
  const selectedPlatform = normalizePlatform(params.platform);
  const selectedSort = normalizeSort(params.sort);
  const query = params.q ?? "";

  // Skip getDashboardOverview (was loading full catalog + daily insights + all comments
  // only for setup flags). Connections without briefs; catalog with hard limit.
  const allConnections = await timer.timeAsync(
    "connections",
    () =>
      listPlatformConnections({
        includeDisconnected: false,
        includeBriefs: false,
      }),
    (rows) => ({ count: rows.length }),
  );
  const platformConnections =
    selectedPlatform === "all"
      ? []
      : allConnections.filter((connection) => connection.platform === selectedPlatform);
  const selectedConnectionId =
    params.connection === "all" || !params.connection
      ? "all"
      : resolvePreferredConnectionId(platformConnections, params.connection ?? null);
  const activeConnectionId = selectedConnectionId === "all" ? "all" : selectedConnectionId;

  const items = await timer.timeAsync(
    "catalog",
    () =>
      listContentLibrary({
        platform: selectedPlatform,
        connectionId: activeConnectionId,
        query,
        limit: CONTENT_LIBRARY_FETCH_LIMIT,
      }),
    (rows) => ({ count: rows.length }),
  );

  const missingEnv = getMissingEnvKeys();
  const setupIssues: string[] = [];
  if (!hasSupabaseConfig()) {
    setupIssues.push(
      "Configura Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY) para cargar la biblioteca.",
    );
  } else if (allConnections.length === 0 && !hasInstagramLegacyConfig()) {
    setupIssues.push("Conecta al menos una cuenta desde Account para habilitar la sincronizacion.");
  }
  const hasSetupIssues = missingEnv.length > 0 || setupIssues.length > 0;

  const reels = items.filter((item) => {
    const kind = getContentKind(item.platform, item.rawPayload);
    if (selectedSection === "all") {
      return true;
    }
    if (selectedSection === "reels") {
      return kind === "Reel";
    }
    if (selectedSection === "videos") {
      return kind === "Video" || item.platform === "youtube";
    }
    if (selectedSection === "stories") {
      return (item.rawPayload.media_product_type as string | undefined) === "STORY";
    }
    if (selectedSection === "carousel") {
      return kind === "Carrusel";
    }
    return true;
  });

  const sortedReels = [...reels].sort((left, right) => {
    if (selectedSort === "recent") {
      return new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime();
    }
    return getItemViews(right) - getItemViews(left);
  });
  const visibleReels = sortedReels.slice(0, CONTENT_LIBRARY_VISIBLE);

  timer.finish({
    platform: selectedPlatform,
    section: selectedSection,
    catalogRows: items.length,
    filteredRows: reels.length,
    visibleRows: visibleReels.length,
    connections: allConnections.length,
  });

  return (
    <div className="space-y-3 py-1">
      <section className="ds-animate-in">
        <p className="text-body-sm text-muted-foreground">Analisis profundo del contenido sincronizado.</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {SECTION_TABS.map((tab) => {
            const isActive = "section" in tab && tab.section === selectedSection;

            return (
              <Link
                key={tab.label}
                prefetch={false}
                href={getContentHref({
                  section: tab.section,
                  platform: selectedPlatform,
                  connectionId: activeConnectionId,
                  query,
                  sort: selectedSort,
                })}
                className={getFilterLinkClass(isActive)}
              >
                {tab.label}
                {isActive ? <ActiveUnderline /> : null}
              </Link>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <span className="text-label font-medium text-muted-foreground">Plataforma:</span>
          {PLATFORM_OPTIONS.map((option) => {
            const isActive = option.value === selectedPlatform;
            return (
              <Link
                key={option.value}
                prefetch={false}
                href={getContentHref({
                  section: selectedSection,
                  platform: option.value,
                  connectionId: "all",
                  query,
                  sort: selectedSort,
                })}
                className={getFilterLinkClass(isActive)}
              >
                {option.label}
                {isActive ? <ActiveUnderline /> : null}
              </Link>
            );
          })}
        </div>

        {selectedPlatform !== "all" && platformConnections.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <span className="text-label font-medium text-muted-foreground">Cuenta:</span>
            <Link
              prefetch={false}
              href={getContentHref({
                section: selectedSection,
                platform: selectedPlatform,
                connectionId: "all",
                query,
                sort: selectedSort,
              })}
              className={getFilterLinkClass(activeConnectionId === "all")}
            >
              Todas
              {activeConnectionId === "all" ? <ActiveUnderline /> : null}
            </Link>
            {platformConnections.map((connection) => {
              const isActive = connection.id === activeConnectionId;
              return (
                <Link
                  key={connection.id}
                  prefetch={false}
                  href={getContentHref({
                    section: selectedSection,
                    platform: selectedPlatform,
                    connectionId: connection.id,
                    query,
                    sort: selectedSort,
                  })}
                  className={getFilterLinkClass(isActive)}
                >
                  {connection.accountUsername ??
                    connection.displayName ??
                    connection.accountExternalId}
                  {isActive ? <ActiveUnderline /> : null}
                </Link>
              );
            })}
          </div>
        ) : null}
      </section>

      {hasSetupIssues ? (
        <SetupChecklist missingEnv={missingEnv} setupIssues={setupIssues} />
      ) : null}


      <section className="ds-animate-in ds-delay-1">
        {visibleReels.length === 0 ? (
          <article className="ds-card rounded-lg p-6">
            <p className="text-body text-muted-foreground">No hay contenido disponible en esta seccion.</p>
          </article>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {visibleReels.map((item, index) => {
              const views = getItemViews(item);
              const reach = getItemReach(item);
              const comments = getItemComments(item);
              const engagement = getItemEngagement(item);
              const title = item.title ?? item.caption ?? "Contenido sin titulo";
              const ageLabel = getPublishedAgeLabel(item.publishedAt);
              const analysisLabel = getAnalysisStatusLabel(item.analysisStatus, item.hasInsight);
              const analysisVariant = getAnalysisStatusVariant(item.analysisStatus, item.hasInsight);

              return (
                <article
                  key={item.id}
                  className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-float transition-all hover:bg-surface-elevated hover:shadow-card-full"
                >
                  <Link href={`/content/${item.id}`} prefetch={false} className="flex flex-1 flex-col">
                  {/* Thumbnail */}
                  <div
                    className={`relative overflow-hidden bg-surface-elevated ${
                      item.platform === "youtube" ? "aspect-video" : "aspect-[4/5]"
                    }`}
                  >
                    {item.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnailUrl}
                        alt={title}
                        loading="lazy"
                        className="h-full w-full object-cover object-center transition-transform duration-200 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-caption text-muted-foreground">
                        Sin preview
                      </div>
                    )}
                    {/* Overlays */}
                    <span className="absolute left-2 top-2 rounded-md border border-border bg-card/90 backdrop-blur-sm px-2 py-0.5 text-micro text-success">
                      +{(engagement / 2).toFixed(1)}
                    </span>
                    <span className="absolute bottom-2 left-2 rounded-md border border-border bg-card/90 backdrop-blur-sm px-2 py-0.5 text-micro text-muted-foreground">
                      {ageLabel}
                    </span>
                    <span className="absolute right-2 top-2 rounded-md border border-border bg-card/90 backdrop-blur-sm px-2 py-0.5 text-micro text-muted-foreground">
                      #{index + 1}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex flex-col gap-2 p-3">
                    <p className="truncate text-body-sm font-medium text-foreground">{title}</p>

                    {/* Analysis badge */}
                    <div>
                      <Badge variant={analysisVariant}>
                        <BrainCircuit />
                        {analysisLabel}
                      </Badge>
                    </div>

                    {/* Metrics — 3 stat cards in a row */}
                    <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-border">
                      <div className="border-r border-border px-2 py-2">
                        <div className="flex items-center gap-1 text-micro text-muted-foreground">
                          <Play className="size-2.5" />
                          <span>Views</span>
                        </div>
                        <p className="mt-1 text-body font-semibold tabular-nums text-foreground">
                          {formatCompactNumber(views)}
                        </p>
                      </div>
                      <div className="border-r border-border px-2 py-2">
                        <div className="flex items-center gap-1 text-micro text-muted-foreground">
                          <Eye className="size-2.5" />
                          <span>Alcance</span>
                        </div>
                        <p className="mt-1 text-body font-semibold tabular-nums text-foreground">
                          {formatCompactNumber(reach)}
                        </p>
                      </div>
                      <div className="px-2 py-2">
                        <div className="flex items-center gap-1 text-micro text-muted-foreground">
                          <MessageCircle className="size-2.5" />
                          <span>Comentarios</span>
                        </div>
                        <p className="mt-1 text-body font-semibold tabular-nums text-foreground">
                          {formatCompactNumber(comments)}
                        </p>
                      </div>
                    </div>

                    <p className="text-label text-muted-foreground">{formatDateOnly(item.publishedAt)}</p>
                  </div>
                  </Link>
                  {item.analysisStatus === "pending" ||
                  item.analysisStatus === "failed" ||
                  isAnalysisProcessingStale(item) ? (
                    <div className="border-t border-border p-3">
                      <AnalyzeContentButton
                        contentId={item.id}
                        status={item.analysisStatus}
                        compact
                        canRetryProcessing={isAnalysisProcessingStale(item)}
                      />
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

      </section>
    </div>
  );
}
