import type { Platform, PlatformFilter } from "@/lib/types";

export const PLATFORM_OPTIONS: Array<{ value: PlatformFilter; label: string }> = [
  { value: "all", label: "Todo" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
];

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

/** CSS colors for each platform. Both themes resolve them via globals.css. */
export const PLATFORM_COLORS: Record<Platform, string> = {
  instagram: "var(--platform-instagram)",
  tiktok: "var(--platform-tiktok)",
  youtube: "var(--platform-youtube)",
};

/** Tailwind text-color classes matching PLATFORM_COLORS. */
export const PLATFORM_TEXT_CLASSES: Record<Platform, string> = {
  instagram: "text-platform-instagram",
  tiktok: "text-platform-tiktok",
  youtube: "text-platform-youtube",
};

export function getPlatformColor(platform: Platform | string | null | undefined) {
  const normalized = normalizePlatform(platform);
  return normalized ? PLATFORM_COLORS[normalized] : "var(--muted-foreground)";
}

export function normalizePlatformFilter(value: string | null | undefined): PlatformFilter {
  return PLATFORM_OPTIONS.some((option) => option.value === value)
    ? (value as PlatformFilter)
    : "all";
}

export function normalizePlatform(value: string | null | undefined): Platform | null {
  if (value === "instagram" || value === "tiktok" || value === "youtube") {
    return value;
  }

  return null;
}

export function getPlatformLabel(platform: Platform | PlatformFilter) {
  if (platform === "all") {
    return "Todo";
  }

  return PLATFORM_LABELS[platform];
}
