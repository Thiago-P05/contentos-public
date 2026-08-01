import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertNoError, isSchemaSetupError } from "@/lib/supabase/errors";
import type {
  AIInsightRow,
  ConnectionBriefRow,
  ConnectionRow,
  ContentRow,
  PlatformCommentRow,
  PlatformDailyInsightRow,
  SnapshotRow,
  AutomationOutputRow,
  AutomationRunRow,
  AutomationRunItemRow,
  SyncRunRow,
  TextAssetRow,
  CompetitorAnalysisRunRow,
  CompetitorContentSnapshotRow,
  CompetitorProfileRow,
} from "@/lib/supabase/types";
import type { AutomationType, PlatformFilter } from "@/lib/types";

const SUPPORTED_PLATFORMS = ["instagram", "tiktok", "youtube"] as const;

export type ContentRowsFilters = {
  platform?: PlatformFilter;
  connectionId?: string | null;
  query?: string;
  contentItemIds?: string[];
  limit?: number;
  offset?: number;
  publishedAfter?: string;
};

export type ContentLibraryRow = Pick<
  ContentRow,
  | "id"
  | "platform"
  | "connection_id"
  | "published_at"
  | "title"
  | "caption"
  | "thumbnail_url"
  | "analysis_status"
  | "analysis_processing_started_at"
  | "raw_payload"
>;

type ContentLibrarySnapshotRow = Pick<SnapshotRow, "content_item_id" | "captured_at" | "metrics">;

function normalizeSearchQuery(value: string | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/[,%"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || null;
}

export async function fetchContentRows(filters?: ContentRowsFilters) {
  const supabase = getSupabaseAdmin();

  if (filters?.contentItemIds && filters.contentItemIds.length === 0) {
    return [];
  }

  let query = supabase.from("content_items").select("*");

  if (filters?.contentItemIds) {
    query = query.in("id", filters.contentItemIds);
  }

  if (filters?.platform && filters.platform !== "all") {
    query = query.eq("platform", filters.platform);
  } else {
    query = query.in("platform", [...SUPPORTED_PLATFORMS]);
  }

  if (filters?.connectionId && filters.connectionId !== "all") {
    query = query.eq("connection_id", filters.connectionId);
  }

  const normalizedQuery = normalizeSearchQuery(filters?.query);

  if (normalizedQuery) {
    query = query.or(
      [
        `title.ilike.%${normalizedQuery}%`,
        `description.ilike.%${normalizedQuery}%`,
        `caption.ilike.%${normalizedQuery}%`,
      ].join(","),
    );
  }

  if (filters?.publishedAfter) {
    query = query.gte("published_at", filters.publishedAfter);
  }

  query = query.order("published_at", { ascending: false });

  const normalizedLimit =
    typeof filters?.limit === "number" && Number.isFinite(filters.limit)
      ? Math.trunc(filters.limit)
      : null;
  const normalizedOffset =
    typeof filters?.offset === "number" && Number.isFinite(filters.offset)
      ? Math.max(Math.trunc(filters.offset), 0)
      : 0;

  if (normalizedLimit && normalizedLimit > 0) {
    query = query.range(normalizedOffset, normalizedOffset + normalizedLimit - 1);
  }

  const { data, error } = await query;

  assertNoError(error);
  return (data ?? []) as ContentRow[];
}

export async function fetchContentLibraryRows(filters?: Omit<ContentRowsFilters, "contentItemIds">) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("content_items")
    .select(
      "id,platform,connection_id,published_at,title,caption,thumbnail_url,analysis_status,analysis_processing_started_at,raw_payload",
    );

  if (filters?.platform && filters.platform !== "all") {
    query = query.eq("platform", filters.platform);
  } else {
    query = query.in("platform", [...SUPPORTED_PLATFORMS]);
  }

  if (filters?.connectionId && filters.connectionId !== "all") {
    query = query.eq("connection_id", filters.connectionId);
  }

  const normalizedQuery = normalizeSearchQuery(filters?.query);
  if (normalizedQuery) {
    query = query.or(
      [
        `title.ilike.%${normalizedQuery}%`,
        `description.ilike.%${normalizedQuery}%`,
        `caption.ilike.%${normalizedQuery}%`,
      ].join(","),
    );
  }

  if (filters?.publishedAfter) {
    query = query.gte("published_at", filters.publishedAfter);
  }

  query = query.order("published_at", { ascending: false });

  const normalizedLimit =
    typeof filters?.limit === "number" && Number.isFinite(filters.limit)
      ? Math.trunc(filters.limit)
      : null;
  const normalizedOffset =
    typeof filters?.offset === "number" && Number.isFinite(filters.offset)
      ? Math.max(Math.trunc(filters.offset), 0)
      : 0;
  if (normalizedLimit && normalizedLimit > 0) {
    query = query.range(normalizedOffset, normalizedOffset + normalizedLimit - 1);
  }

  const { data, error } = await query;
  assertNoError(error);
  return (data ?? []) as ContentLibraryRow[];
}

export async function fetchLatestContentLibrarySnapshotRows(contentItemIds: string[]) {
  const supabase = getSupabaseAdmin();
  if (contentItemIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("latest_content_metric_snapshots")
    .select("content_item_id,captured_at,metrics")
    .in("content_item_id", contentItemIds)
    .order("captured_at", { ascending: false });

  if (!error) {
    return (data ?? []) as ContentLibrarySnapshotRow[];
  }

  if (!isSchemaSetupError(error)) {
    assertNoError(error);
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from("content_metric_snapshots")
    .select("content_item_id,captured_at,metrics")
    .in("content_item_id", contentItemIds)
    .order("captured_at", { ascending: false });
  assertNoError(fallbackError);

  const latest: ContentLibrarySnapshotRow[] = [];
  const seen = new Set<string>();
  for (const row of (fallback ?? []) as ContentLibrarySnapshotRow[]) {
    if (!seen.has(row.content_item_id)) {
      seen.add(row.content_item_id);
      latest.push(row);
    }
  }
  return latest;
}

export async function fetchContentLibraryInsightIds(contentItemIds: string[]) {
  if (contentItemIds.length === 0) {
    return [];
  }

  const { data, error } = await getSupabaseAdmin()
    .from("ai_insights")
    .select("content_item_id")
    .in("content_item_id", contentItemIds);
  assertNoError(error);
  return (data ?? []) as Array<{ content_item_id: string }>;
}

export async function fetchSnapshotRows(filters?: {
  contentItemIds?: string[];
}) {
  const supabase = getSupabaseAdmin();

  if (filters?.contentItemIds && filters.contentItemIds.length === 0) {
    return [];
  }

  let query = supabase.from("content_metric_snapshots").select("*");

  if (filters?.contentItemIds) {
    query = query.in("content_item_id", filters.contentItemIds);
  }

  const { data, error } = await query.order("captured_at", { ascending: false });

  assertNoError(error);
  return (data ?? []) as SnapshotRow[];
}

export async function fetchLatestSnapshotRows(contentItemIds: string[]) {
  const supabase = getSupabaseAdmin();

  if (contentItemIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("latest_content_metric_snapshots")
    .select("*")
    .in("content_item_id", contentItemIds)
    .order("captured_at", { ascending: false });

  if (!error) {
    return (data ?? []) as SnapshotRow[];
  }

  if (!isSchemaSetupError(error)) {
    assertNoError(error);
  }

  const fallback = await fetchSnapshotRows({
    contentItemIds,
  });
  const latest: SnapshotRow[] = [];
  const seen = new Set<string>();

  for (const row of fallback) {
    if (seen.has(row.content_item_id)) {
      continue;
    }

    seen.add(row.content_item_id);
    latest.push(row);
  }

  return latest;
}

export async function fetchInsightRows(contentItemIds?: string[]) {
  const supabase = getSupabaseAdmin();

  if (contentItemIds && contentItemIds.length === 0) {
    return [];
  }

  let query = supabase.from("ai_insights").select("*");

  if (contentItemIds) {
    query = query.in("content_item_id", contentItemIds);
  }

  const { data, error } = await query;

  assertNoError(error);
  return (data ?? []) as AIInsightRow[];
}

export async function fetchConnectionRows(filters?: {
  platform?: PlatformFilter;
  includeDisconnected?: boolean;
  connectionId?: string | null;
}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("platform_connections")
    .select("*")
    .order("created_at", { ascending: true });

  if (filters?.platform && filters.platform !== "all") {
    query = query.eq("platform", filters.platform);
  } else {
    query = query.in("platform", [...SUPPORTED_PLATFORMS]);
  }

  if (!filters?.includeDisconnected) {
    query = query.eq("status", "active");
  }

  if (filters?.connectionId) {
    query = query.eq("id", filters.connectionId);
  }

  const { data, error } = await query;

  assertNoError(error);
  return (data ?? []) as ConnectionRow[];
}

export async function fetchConnectionBriefRows(connectionIds?: string[]) {
  const supabase = getSupabaseAdmin();

  if (connectionIds && connectionIds.length === 0) {
    return [];
  }

  let query = supabase.from("platform_connection_briefs").select("*");

  if (connectionIds) {
    query = query.in("connection_id", connectionIds);
  }

  const { data, error } = await query.order("created_at", { ascending: true });

  assertNoError(error);
  return (data ?? []) as ConnectionBriefRow[];
}

export async function fetchConnectionBriefRow(connectionId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("platform_connection_briefs")
    .select("*")
    .eq("connection_id", connectionId)
    .maybeSingle();

  assertNoError(error);
  return data ? (data as ConnectionBriefRow) : null;
}

export async function fetchPlatformDailyInsightRows(filters?: {
  platform?: PlatformFilter;
  connectionId?: string | null;
  since?: string | null;
  until?: string | null;
}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("platform_daily_insights")
    .select("*")
    .order("insight_date", { ascending: true });

  if (filters?.platform && filters.platform !== "all") {
    query = query.eq("platform", filters.platform);
  } else {
    query = query.in("platform", [...SUPPORTED_PLATFORMS]);
  }

  if (filters?.connectionId && filters.connectionId !== "all") {
    query = query.eq("connection_id", filters.connectionId);
  }

  if (filters?.since) {
    query = query.gte("insight_date", filters.since);
  }

  if (filters?.until) {
    query = query.lte("insight_date", filters.until);
  }

  const { data, error } = await query;

  assertNoError(error);
  return (data ?? []) as PlatformDailyInsightRow[];
}

export async function fetchConnectionById(connectionId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("platform_connections")
    .select("*")
    .eq("id", connectionId)
    .in("platform", [...SUPPORTED_PLATFORMS])
    .maybeSingle();

  assertNoError(error);
  return data ? (data as ConnectionRow) : null;
}

export async function fetchSyncRunRows(
  limit: number,
  filters?: {
    platform?: PlatformFilter;
    connectionId?: string | null;
  },
) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("sync_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (filters?.platform && filters.platform !== "all") {
    query = query.eq("platform", filters.platform);
  } else {
    query = query.in("platform", [...SUPPORTED_PLATFORMS]);
  }

  if (filters?.connectionId && filters.connectionId !== "all") {
    query = query.eq("connection_id", filters.connectionId);
  }

  const { data, error } = await query;

  assertNoError(error);
  return (data ?? []) as SyncRunRow[];
}

export async function fetchContentRowById(contentItemId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("content_items")
    .select("*")
    .eq("id", contentItemId)
    .in("platform", [...SUPPORTED_PLATFORMS])
    .maybeSingle();

  assertNoError(error);
  return data ? (data as ContentRow) : null;
}

export async function fetchSnapshotRowsByContentItem(contentItemId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("content_metric_snapshots")
    .select("*")
    .eq("content_item_id", contentItemId)
    .order("captured_at", { ascending: false });

  assertNoError(error);
  return (data ?? []) as SnapshotRow[];
}

export async function fetchTextAssetRowsByContentItem(contentItemId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("content_text_assets")
    .select("*")
    .eq("content_item_id", contentItemId)
    .order("created_at", { ascending: true });

  assertNoError(error);
  return (data ?? []) as TextAssetRow[];
}

export async function fetchTextAssetRowsByContentItems(contentItemIds: string[]) {
  if (contentItemIds.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("content_text_assets")
    .select("*")
    .in("content_item_id", contentItemIds)
    .order("created_at", { ascending: true });

  assertNoError(error);
  return (data ?? []) as TextAssetRow[];
}

export async function fetchInsightRowByContentItem(contentItemId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ai_insights")
    .select("*")
    .eq("content_item_id", contentItemId)
    .maybeSingle();

  assertNoError(error);
  return data ? (data as AIInsightRow) : null;
}


export async function fetchPlatformCommentRows(filters?: {
  platform?: PlatformFilter;
  connectionId?: string | null;
  limit?: number;
  since?: string | null;
  until?: string | null;
}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("platform_comments")
    .select("*")
    .order("commented_at", { ascending: false });

  if (filters?.platform && filters.platform !== "all") {
    query = query.eq("platform", filters.platform);
  } else {
    query = query.in("platform", [...SUPPORTED_PLATFORMS]);
  }

  if (filters?.connectionId && filters.connectionId !== "all") {
    query = query.eq("connection_id", filters.connectionId);
  }

  if (filters?.since) {
    const sinceIso = filters.since.includes("T")
      ? filters.since
      : `${filters.since}T00:00:00.000Z`;
    query = query.gte("commented_at", sinceIso);
  }

  if (filters?.until) {
    const untilIso = filters.until.includes("T")
      ? filters.until
      : `${filters.until}T23:59:59.999Z`;
    query = query.lte("commented_at", untilIso);
  }

  if (typeof filters?.limit === "number") {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  assertNoError(error);
  return (data ?? []) as PlatformCommentRow[];
}


export async function fetchCompetitorProfileByUsername(platform: "instagram", username: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("competitor_profiles")
    .select("*")
    .eq("platform", platform)
    .eq("username", username)
    .maybeSingle();

  assertNoError(error);
  return data ? (data as CompetitorProfileRow) : null;
}

export async function fetchCompetitorProfileById(profileId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("competitor_profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle();

  assertNoError(error);
  return data ? (data as CompetitorProfileRow) : null;
}

export async function fetchCompetitorProfileRows(profileIds?: string[]) {
  const supabase = getSupabaseAdmin();

  if (profileIds && profileIds.length === 0) {
    return [];
  }

  let query = supabase.from("competitor_profiles").select("*");

  if (profileIds) {
    query = query.in("id", profileIds);
  }

  const { data, error } = await query.order("updated_at", { ascending: false });

  assertNoError(error);
  return (data ?? []) as CompetitorProfileRow[];
}

export async function fetchCompetitorAnalysisRunRow(runId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("competitor_analysis_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();

  assertNoError(error);
  return data ? (data as CompetitorAnalysisRunRow) : null;
}

export async function fetchCompetitorAnalysisRunRows(limit = 10) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("competitor_analysis_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  assertNoError(error);
  return (data ?? []) as CompetitorAnalysisRunRow[];
}

export async function fetchCompetitorContentSnapshotRows(analysisRunId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("competitor_content_snapshots")
    .select("*")
    .eq("analysis_run_id", analysisRunId)
    .order("published_at", { ascending: false, nullsFirst: false });

  assertNoError(error);
  return (data ?? []) as CompetitorContentSnapshotRow[];
}

export async function fetchAutomationRunRows(limit = 20, filters?: { type?: AutomationType }) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("automation_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (filters?.type) {
    query = query.eq("type", filters.type);
  }

  const { data, error } = await query;

  assertNoError(error);
  return (data ?? []) as AutomationRunRow[];
}

export async function fetchAutomationRunRow(runId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("automation_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();

  assertNoError(error);
  return data ? (data as AutomationRunRow) : null;
}

export async function fetchAutomationOutputRows(runId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("automation_outputs")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: true });

  assertNoError(error);
  return (data ?? []) as AutomationOutputRow[];
}

export async function fetchAutomationRunItemRows(runId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("automation_run_items")
    .select("*")
    .eq("run_id", runId)
    .order("position", { ascending: true });

  assertNoError(error);
  return (data ?? []) as AutomationRunItemRow[];
}
