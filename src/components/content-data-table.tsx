"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, FileText, Search, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCompactNumber, formatDateOnly, formatPercent } from "@/lib/format";
import { getContentKind } from "@/lib/content-media";
import { PLATFORM_TEXT_CLASSES } from "@/lib/platforms";
import { metricValue } from "@/lib/utils";
import type { ContentListItem, Platform } from "@/lib/types";

type SortKey = "views" | "engagement" | "comments";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "views", label: "Vistas" },
  { value: "engagement", label: "Engagement" },
  { value: "comments", label: "Comentarios" },
];

const TOP_N = 8;

function getKind(item: ContentListItem) {
  return getContentKind(item.platform, item.rawPayload);
}

function getViews(item: ContentListItem): number {
  return metricValue(item.latestMetrics, "views", "viewCount", "reach") ?? 0;
}

function getComments(item: ContentListItem): number | null {
  return metricValue(item.latestMetrics, "comments") ?? null;
}

function getInteractions(item: ContentListItem): number | null {
  return metricValue(item.latestMetrics, "contentInteractions", "totalInteractions", "likes");
}

function getEngagementRate(item: ContentListItem): number | null {
  const views = getViews(item);
  const interactions = getInteractions(item);
  if (!views || interactions == null) return null;
  return (interactions / views) * 100;
}

function sortItems(items: ContentListItem[], sort: SortKey): ContentListItem[] {
  return [...items].sort((a, b) => {
    if (sort === "views") return getViews(b) - getViews(a);
    if (sort === "comments") return (getComments(b) ?? -1) - (getComments(a) ?? -1);
    return (getEngagementRate(b) ?? -1) - (getEngagementRate(a) ?? -1);
  });
}

const PLATFORM_COLORS: Record<Platform, string> = PLATFORM_TEXT_CLASSES;

const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

function KindBadge({ kind }: { kind: string }) {
  const k = kind.toLowerCase();
  const variant =
    k === "reel" || k === "video" ? "success" : k === "carrusel" ? "warning" : "secondary";

  return (
    <Badge variant={variant}>
      <span className="size-1.5 rounded-full bg-current" />
      {kind}
    </Badge>
  );
}

function EngagementCell({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-muted-foreground">—</span>;
  const isHigh = rate >= 5;
  const isLow = rate < 1;
  return (
    <span
      className={[
        "inline-flex items-center gap-1 font-mono tabular-nums",
        isHigh ? "text-success" : isLow ? "text-danger" : "text-foreground",
      ].join(" ")}
    >
      {isHigh ? <TrendingUp className="size-3.5" /> : isLow ? <TrendingDown className="size-3.5" /> : null}
      {formatPercent(rate)}
    </span>
  );
}

export function ContentDataTable({ items }: { items: ContentListItem[] }) {
  const [sort, setSort] = useState<SortKey>("views");
  const [search, setSearch] = useState("");

  const filtered = items.filter((item) => {
    if (!search) return true;
    const caption = (item.caption ?? item.title ?? item.description ?? "").toLowerCase();
    return caption.includes(search.toLowerCase());
  });

  const sorted = sortItems(filtered, sort).slice(0, TOP_N);

  return (
    <div className="border-t border-border bg-card">
      {/* Table header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="size-4" />
          <span>Posts recientes</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Sort tabs */}
          <div className="mr-2 flex items-center gap-3">
            {SORT_OPTIONS.map((option) => {
              const isActive = sort === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSort(option.value)}
                  className={[
                    "relative pb-1 text-body-sm font-medium transition-colors",
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {option.label}
                  {isActive && (
                    <span className="absolute inset-x-0 bottom-0 h-px bg-success" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-[180px] rounded-md pl-8 text-xs"
            />
          </div>

        </div>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="pl-4">Contenido</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Plataforma</TableHead>
            <TableHead className="text-right">Vistas</TableHead>
            <TableHead className="text-right">Interacciones</TableHead>
            <TableHead className="text-right">Comentarios</TableHead>
            <TableHead className="text-right">Engagement</TableHead>
            <TableHead className="hidden md:table-cell">Publicado</TableHead>
            <TableHead className="w-10 pr-4" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={9}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                Sin contenido disponible.
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((item) => {
              const views = getViews(item);
              const interactions = getInteractions(item);
              const comments = getComments(item);
              const engRate = getEngagementRate(item);
              const kind = getKind(item);
              const caption =
                item.caption ?? item.title ?? item.description ?? "Sin título";
              const displayCaption =
                caption.length > 50 ? caption.slice(0, 50) + "…" : caption;

              return (
                <TableRow key={item.id} className="border-border">
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <div className="relative size-8 shrink-0 overflow-hidden rounded-md bg-surface-elevated">
                        {item.thumbnailUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={item.thumbnailUrl}
                            alt=""
                            loading="lazy"
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <span className="max-w-[160px] truncate text-body font-medium text-foreground">
                        {displayCaption}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <KindBadge kind={kind} />
                  </TableCell>

                  <TableCell>
                    <span className={`text-sm font-medium ${PLATFORM_COLORS[item.platform] ?? "text-foreground"}`}>
                      {PLATFORM_LABELS[item.platform] ?? item.platform}
                    </span>
                  </TableCell>

                  <TableCell className="text-right font-mono text-body tabular-nums text-foreground">
                    {formatCompactNumber(views)}
                  </TableCell>

                  <TableCell className="text-right font-mono text-body tabular-nums text-muted-foreground">
                    {formatCompactNumber(interactions)}
                  </TableCell>

                  <TableCell className="text-right font-mono text-body tabular-nums text-muted-foreground">
                    {formatCompactNumber(comments)}
                  </TableCell>

                  <TableCell className="text-right text-body">
                    <EngagementCell rate={engRate} />
                  </TableCell>

                  <TableCell className="hidden text-body-sm text-muted-foreground md:table-cell">
                    {formatDateOnly(item.publishedAt)}
                  </TableCell>

                  <TableCell className="pr-4">
                    <Link href={`/content/${item.id}`}>
                      <button
                        type="button"
                        className="flex size-8 items-center justify-center text-muted-foreground transition hover:text-foreground"
                      >
                        <ArrowUpRight className="size-4" />
                        <span className="sr-only">Ver detalle</span>
                      </button>
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
