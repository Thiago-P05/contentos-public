import type { ContentItem, DashboardRange } from "@/lib/types";

export const DASHBOARD_RANGE_OPTIONS = [
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "quarter", label: "Trimestre" },
  { value: "year", label: "Anual" },
  { value: "last30", label: "30 Dias" },
  { value: "last60", label: "60 Dias" },
  { value: "last90", label: "90 Dias" },
] as const;

const DASHBOARD_TIMEZONE = "America/Buenos_Aires";

function getFormatter(options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: DASHBOARD_TIMEZONE,
    ...options,
  });
}

function getDatePartsInTimeZone(value: Date) {
  const formatter = getFormatter({
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(value);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "0");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "0");

  return { year, month, day };
}

function getDateTimePartsInTimeZone(value: Date) {
  const formatter = getFormatter({
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(value);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "0");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "0");
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");

  return { year, month, day, hour };
}

function toUtcDateOnly(parts: { year: number; month: number; day: number }) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

function toUtcDateTime(parts: { year: number; month: number; day: number; hour: number }) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour));
}

function getCurrentDateOnly(now = new Date()) {
  return toUtcDateOnly(getDatePartsInTimeZone(now));
}

function subtractUtcDays(value: Date, amount: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() - amount);
  return next;
}

function addUtcDays(value: Date, amount: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function addUtcHours(value: Date, amount: number) {
  const next = new Date(value);
  next.setUTCHours(next.getUTCHours() + amount);
  return next;
}

function addUtcMonths(value: Date, amount: number) {
  const next = new Date(value);
  next.setUTCMonth(next.getUTCMonth() + amount);
  return next;
}

function getRangeStart(range: DashboardRange, now = new Date()) {
  if (range === "all") {
    return null;
  }

  const currentDate = getCurrentDateOnly(now);
  const year = currentDate.getUTCFullYear();
  const month = currentDate.getUTCMonth();
  const dayOfWeek = currentDate.getUTCDay();

  switch (range) {
    case "day":
      return currentDate;
    case "week":
      return subtractUtcDays(currentDate, (dayOfWeek + 6) % 7);
    case "month":
      return new Date(Date.UTC(year, month, 1));
    case "quarter":
      return new Date(Date.UTC(year, Math.floor(month / 3) * 3, 1));
    case "year":
      return new Date(Date.UTC(year, 0, 1));
    // Rolling windows: end = today - 2, so start = (today - 2) - (N - 1)
    case "last30":
      return subtractUtcDays(currentDate, 31);
    case "last60":
      return subtractUtcDays(currentDate, 61);
    case "last90":
      return subtractUtcDays(currentDate, 91);
    default:
      return null;
  }
}

type SeriesBucketType = "hour" | "day" | "week" | "month";

type PerformanceSource = Pick<ContentItem, "publishedAt"> & {
  views: number;
};

function getSeriesConfig(range: DashboardRange) {
  switch (range) {
    case "day":
      return { bucketType: "hour" as const };
    case "week":
      return { bucketType: "day" as const };
    case "month":
      return { bucketType: "day" as const };
    case "quarter":
      return { bucketType: "week" as const };
    case "year":
      return { bucketType: "month" as const };
    case "all":
      return { bucketType: "month" as const };
    case "last30":
    case "last60":
    case "last90":
      return { bucketType: "day" as const };
    default:
      return { bucketType: "day" as const };
  }
}

function getBucketStart(value: Date, bucketType: SeriesBucketType) {
  if (bucketType === "hour") {
    return toUtcDateTime(getDateTimePartsInTimeZone(value));
  }

  const dateOnly = toUtcDateOnly(getDatePartsInTimeZone(value));

  if (bucketType === "day") {
    return dateOnly;
  }

  if (bucketType === "week") {
    const dayOfWeek = dateOnly.getUTCDay();
    return subtractUtcDays(dateOnly, (dayOfWeek + 6) % 7);
  }

  return new Date(Date.UTC(dateOnly.getUTCFullYear(), dateOnly.getUTCMonth(), 1));
}

function formatBucketLabel(value: Date, bucketType: SeriesBucketType) {
  if (bucketType === "hour") {
    return `${String(value.getUTCHours()).padStart(2, "0")}:00`;
  }

  if (bucketType === "month") {
    const monthNames = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return `${monthNames[value.getUTCMonth()]} ${String(value.getUTCFullYear()).slice(-2)}`;
  }

  return `${String(value.getUTCDate()).padStart(2, "0")}/${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getRangeBounds(items: PerformanceSource[], range: DashboardRange, now = new Date()) {
  const bucketType = getSeriesConfig(range).bucketType;

  if (range === "all") {
    if (items.length === 0) {
      return null;
    }

    const timestamps = items.map((item) => new Date(item.publishedAt).getTime());
    const first = new Date(Math.min(...timestamps));
    const last = new Date(Math.max(...timestamps));

    return {
      start: getBucketStart(first, bucketType),
      end: getBucketStart(last, bucketType),
      bucketType,
    };
  }

  const rangeStart = getRangeStart(range, now);

  if (!rangeStart) {
    return null;
  }

  if (bucketType === "hour") {
    return {
      start: toUtcDateTime({ ...getDatePartsInTimeZone(now), hour: 0 }),
      end: getBucketStart(now, bucketType),
      bucketType,
    };
  }

  const isRolling = range === "last30" || range === "last60" || range === "last90";
  const seriesEnd = isRolling
    ? getBucketStart(subtractUtcDays(getCurrentDateOnly(now), 2), bucketType)
    : getBucketStart(now, bucketType);

  return {
    start: rangeStart,
    end: seriesEnd,
    bucketType,
  };
}

function getNextBucketDate(value: Date, bucketType: SeriesBucketType) {
  switch (bucketType) {
    case "hour":
      return addUtcHours(value, 1);
    case "day":
      return addUtcDays(value, 1);
    case "week":
      return addUtcDays(value, 7);
    case "month":
      return addUtcMonths(value, 1);
    default:
      return addUtcDays(value, 1);
  }
}

export function normalizeDashboardRange(value: string | null | undefined): DashboardRange {
  return DASHBOARD_RANGE_OPTIONS.some((option) => option.value === value)
    ? (value as DashboardRange)
    : "last30";
}

function formatAnchorValue(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function parseAnchorValue(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function endOfMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));
}

function endOfQuarter(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 3, 0));
}

function endOfYear(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), 11, 31));
}

function startOfRangeFromAnchor(range: DashboardRange, anchorDate: Date) {
  const year = anchorDate.getUTCFullYear();
  const month = anchorDate.getUTCMonth();
  const dayOfWeek = anchorDate.getUTCDay();

  switch (range) {
    case "day":
      return anchorDate;
    case "week":
      return subtractUtcDays(anchorDate, (dayOfWeek + 6) % 7);
    case "month":
      return new Date(Date.UTC(year, month, 1));
    case "quarter":
      return new Date(Date.UTC(year, Math.floor(month / 3) * 3, 1));
    case "year":
      return new Date(Date.UTC(year, 0, 1));
    // Rolling windows: anchor = end date, start = anchor - (N-1) days
    case "last30":
      return subtractUtcDays(anchorDate, 29);
    case "last60":
      return subtractUtcDays(anchorDate, 59);
    case "last90":
      return subtractUtcDays(anchorDate, 89);
    default:
      return anchorDate;
  }
}

function endOfRangeFromAnchor(range: DashboardRange, start: Date) {
  switch (range) {
    case "day":
      return start;
    case "week":
      return addUtcDays(start, 6);
    case "month":
      return endOfMonth(start);
    case "quarter":
      return endOfQuarter(start);
    case "year":
      return endOfYear(start);
    // Rolling windows: end = start + (N-1) days = original anchor
    case "last30":
      return addUtcDays(start, 29);
    case "last60":
      return addUtcDays(start, 59);
    case "last90":
      return addUtcDays(start, 89);
    default:
      return start;
  }
}

export function normalizeDashboardAnchor(value: string | null | undefined) {
  const parsed = parseAnchorValue(value);
  return parsed ? formatAnchorValue(parsed) : null;
}

export function getDashboardCurrentAnchor(now = new Date()) {
  return formatAnchorValue(getCurrentDateOnly(now));
}

export function getDashboardPreviousAnchor(
  range: DashboardRange,
  anchor: string | null | undefined,
  now = new Date(),
) {
  const base = parseAnchorValue(anchor) ?? getCurrentDateOnly(now);
  const previous = new Date(base);

  switch (range) {
    case "day":
      previous.setUTCDate(previous.getUTCDate() - 1);
      break;
    case "week":
      previous.setUTCDate(previous.getUTCDate() - 7);
      break;
    case "month":
      previous.setUTCMonth(previous.getUTCMonth() - 1);
      break;
    case "quarter":
      previous.setUTCMonth(previous.getUTCMonth() - 3);
      break;
    case "year":
      previous.setUTCFullYear(previous.getUTCFullYear() - 1);
      break;
    case "all":
      previous.setUTCMonth(previous.getUTCMonth() - 1);
      break;
    case "last30":
      previous.setUTCDate(previous.getUTCDate() - 30);
      break;
    case "last60":
      previous.setUTCDate(previous.getUTCDate() - 60);
      break;
    case "last90":
      previous.setUTCDate(previous.getUTCDate() - 90);
      break;
  }

  return formatAnchorValue(previous);
}

export function getDashboardRangeBounds(
  range: DashboardRange,
  anchor: string | null | undefined,
  now = new Date(),
) {
  if (range === "all") {
    return {
      start: null,
      end: null,
      anchor: normalizeDashboardAnchor(anchor) ?? getDashboardCurrentAnchor(now),
    };
  }

  const currentDate = getCurrentDateOnly(now);
  const isRolling = range === "last30" || range === "last60" || range === "last90";
  // Rolling windows end 2 days before today (platform data takes 1-2 days to finalize)
  const defaultAnchor = isRolling ? subtractUtcDays(currentDate, 2) : currentDate;
  const requestedAnchor = parseAnchorValue(anchor) ?? defaultAnchor;
  // For rolling ranges, cap anchor at defaultAnchor so latestDataAnchor never pushes end past today-2
  const anchorDate =
    isRolling && requestedAnchor.getTime() > defaultAnchor.getTime()
      ? defaultAnchor
      : requestedAnchor;
  const start = startOfRangeFromAnchor(range, anchorDate);
  let end = endOfRangeFromAnchor(range, start);
  const currentStart = startOfRangeFromAnchor(range, defaultAnchor);

  if (start.getTime() === currentStart.getTime() && end.getTime() > defaultAnchor.getTime()) {
    end = defaultAnchor;
  }

  return {
    start,
    end,
    anchor: formatAnchorValue(anchorDate),
  };
}

export function getDashboardRangeLabel(range: DashboardRange) {
  return DASHBOARD_RANGE_OPTIONS.find((option) => option.value === range)?.label ?? "Mes";
}

export function filterItemsByDashboardRange<T extends Pick<ContentItem, "publishedAt">>(
  items: T[],
  range: DashboardRange,
  anchor?: string | null,
  now = new Date(),
) {
  const bounds = getDashboardRangeBounds(range, anchor, now);

  if (!bounds.start || !bounds.end) {
    return items;
  }

  return items.filter((item) => {
    const itemDate = toUtcDateOnly(getDatePartsInTimeZone(new Date(item.publishedAt)));
    return itemDate.getTime() >= bounds.start!.getTime() && itemDate.getTime() <= bounds.end!.getTime();
  });
}
export function buildDashboardPerformanceSeries(
  items: PerformanceSource[],
  range: DashboardRange,
  now = new Date(),
) {
  const bounds = getRangeBounds(items, range, now);

  if (!bounds) {
    return [];
  }

  const totals = new Map<string, number>();

  for (const item of items) {
    const bucketStart = getBucketStart(new Date(item.publishedAt), bounds.bucketType);
    const key = bucketStart.toISOString();
    totals.set(key, (totals.get(key) ?? 0) + item.views);
  }

  const series: Array<{
    label: string;
    publishedAt: string;
    views: number;
  }> = [];

  let current = new Date(bounds.start);

  while (current.getTime() <= bounds.end.getTime()) {
    const key = current.toISOString();
    series.push({
      label: formatBucketLabel(current, bounds.bucketType),
      publishedAt: key,
      views: totals.get(key) ?? 0,
    });
    current = getNextBucketDate(current, bounds.bucketType);
  }

  return series;
}
