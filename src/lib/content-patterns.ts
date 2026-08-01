import { getContentKind } from "@/lib/content-media";
import type { ContentListItem } from "@/lib/types";
import { metricValue } from "@/lib/utils";

type PatternItem = {
  label: string;
  count: number;
  totalViews: number;
  totalComments: number;
  avgViews: number;
  avgComments: number;
  bestContentId: string | null;
  bestContentTitle: string | null;
};

type ContentIdea = {
  title: string;
  angle: string;
  why: string;
};

type InternalPatternItem = Omit<PatternItem, "avgViews" | "avgComments"> & {
  bestViews: number;
};

type PatternsResult = {
  hooks: PatternItem[];
  ctas: PatternItem[];
  themes: PatternItem[];
  formats: PatternItem[];
  ideas: ContentIdea[];
};

const CTA_PATTERNS = [
  { label: "Comenta", patterns: ["comenta", "comentá", "deja tu comentario"] },
  { label: "Guarda", patterns: ["guarda", "guardá", "guardalo", "guardalo"] },
  { label: "Comparte", patterns: ["comparte", "comparti", "compartí", "enviaselo", "enviáselo"] },
  { label: "Escribime", patterns: ["escribime", "escribime", "mandame", "mándame", "dm"] },
  { label: "Seguime", patterns: ["seguime", "seguime", "seguí", "sigueme"] },
  { label: "Responde", patterns: ["responde", "respondé", "decime", "decinos"] },
  { label: "Link en bio", patterns: ["link en bio", "enlace en bio"] },
] as const;

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function displayTitle(item: ContentListItem) {
  return item.title ?? item.caption?.slice(0, 80) ?? "Contenido sin titulo";
}

function extractCtas(caption: string | null, hooks: string[]) {
  const source = normalizeText([caption ?? "", ...hooks].join(" "));
  const matches = new Set<string>();

  for (const cta of CTA_PATTERNS) {
    if (cta.patterns.some((pattern) => source.includes(normalizeText(pattern)))) {
      matches.add(cta.label);
    }
  }

  return [...matches];
}

function updatePatternMap(
  map: Map<string, InternalPatternItem>,
  label: string,
  item: ContentListItem,
) {
  const key = label.trim();
  if (!key) {
    return;
  }

  const views = metricValue(item.latestMetrics, "views", "viewCount", "reach") ?? 0;
  const comments = metricValue(item.latestMetrics, "comments") ?? 0;
  const current = map.get(key);

  if (!current) {
    map.set(key, {
      label: key,
      count: 1,
      totalViews: views,
      totalComments: comments,
      bestContentId: item.id,
      bestContentTitle: displayTitle(item),
      bestViews: views,
    });
    return;
  }

  current.count += 1;
  current.totalViews += views;
  current.totalComments += comments;

  if (views >= current.bestViews) {
    current.bestContentId = item.id;
    current.bestContentTitle = displayTitle(item);
    current.bestViews = views;
  }
}

function finalizePatterns(
  map: Map<string, InternalPatternItem>,
) {
  return [...map.values()]
    .map((item) => ({
      label: item.label,
      count: item.count,
      totalViews: item.totalViews,
      totalComments: item.totalComments,
      bestContentId: item.bestContentId,
      bestContentTitle: item.bestContentTitle,
      avgViews: item.count > 0 ? item.totalViews / item.count : 0,
      avgComments: item.count > 0 ? item.totalComments / item.count : 0,
    }))
    .sort((left, right) => {
      if (right.totalComments !== left.totalComments) {
        return right.totalComments - left.totalComments;
      }

      if (right.totalViews !== left.totalViews) {
        return right.totalViews - left.totalViews;
      }

      return right.count - left.count;
    });
}

function buildIdeas({
  hooks,
  ctas,
  themes,
  formats,
}: Omit<PatternsResult, "ideas">): ContentIdea[] {
  const topHook = hooks[0]?.label ?? "abrir con una promesa concreta";
  const secondHook = hooks[1]?.label ?? "mostrar el problema desde el primer segundo";
  const topCta = ctas[0]?.label ?? "Comenta";
  const secondCta = ctas[1]?.label ?? "Guarda";
  const topTheme = themes[0]?.label ?? "casos reales";
  const topFormat = formats[0]?.label ?? "Reel";

  return [
    {
      title: `${topFormat} con hook de alto impacto`,
      angle: `Abrir con "${topHook}" y cerrar con CTA "${topCta}".`,
      why: "Combina el hook que mejor tracciona con la llamada a la accion que mas comentarios concentra.",
    },
    {
      title: "Serie de respuesta corta",
      angle: `Version corta sobre ${topTheme} usando "${secondHook}" en los primeros dos segundos.`,
      why: "Sirve para iterar rapido sobre el angulo que ya viene funcionando sin aumentar la complejidad del guion.",
    },
    {
      title: "CTA dual",
      angle: `Pieza que primero invita a "${topCta}" y luego remata con "${secondCta}" al final.`,
      why: "Te deja medir si conviene priorizar comentario o guardado cuando el contenido ya tiene atencion.",
    },
    {
      title: "Misma idea, distinto formato",
      angle: `Tomar el tema ${topTheme} y llevarlo a una variante ${topFormat === "Carrusel" ? "Reel" : "Carrusel"}.`,
      why: "Te da una comparacion directa entre formato y angulo sin cambiar demasiado la premisa del contenido.",
    },
  ];
}

export function buildContentPatterns(items: ContentListItem[]): PatternsResult {
  const hookMap = new Map<string, InternalPatternItem>();
  const ctaMap = new Map<string, InternalPatternItem>();
  const themeMap = new Map<string, InternalPatternItem>();
  const formatMap = new Map<string, InternalPatternItem>();

  for (const item of items) {
    const hooks = item.latestInsight?.hooks ?? [];
    const themes = item.latestInsight?.topics ?? [];
    const ctas = extractCtas(item.caption, hooks);
    const format = getContentKind(item.platform, item.rawPayload);

    updatePatternMap(formatMap, format, item);

    for (const hook of hooks) {
      updatePatternMap(hookMap, hook, item);
    }

    for (const theme of themes) {
      updatePatternMap(themeMap, theme, item);
    }

    for (const cta of ctas) {
      updatePatternMap(ctaMap, cta, item);
    }
  }

  const hooks = finalizePatterns(hookMap).slice(0, 8);
  const ctas = finalizePatterns(ctaMap).slice(0, 8);
  const themes = finalizePatterns(themeMap).slice(0, 8);
  const formats = finalizePatterns(formatMap).slice(0, 4);
  const ideas = buildIdeas({ hooks, ctas, themes, formats });

  return {
    hooks,
    ctas,
    themes,
    formats,
    ideas,
  };
}
