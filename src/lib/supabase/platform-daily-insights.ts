import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertNoError, isSchemaSetupError } from "@/lib/supabase/errors";
import type { Platform, PlatformDailyInsightInput } from "@/lib/types";
import type { PlatformDailyInsightRow } from "@/lib/supabase/types";

export async function getLatestPlatformDailyInsightDate(
  platform: Platform,
  connectionId: string,
) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("platform_daily_insights")
    .select("insight_date")
    .eq("platform", platform)
    .eq("connection_id", connectionId)
    .eq("period", "day")
    .order("insight_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  assertNoError(error);
  return (data as { insight_date?: string } | null)?.insight_date ?? null;
}

export async function getPreviousPlatformDailyInsight(
  platform: Platform,
  connectionId: string,
  beforeDate: string,
) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("platform_daily_insights")
    .select("*")
    .eq("platform", platform)
    .eq("connection_id", connectionId)
    .eq("period", "day")
    .lt("insight_date", beforeDate)
    .order("insight_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  assertNoError(error);
  return data ? (data as PlatformDailyInsightRow) : null;
}

export async function upsertPlatformDailyInsights(rows: PlatformDailyInsightInput[]) {
  if (rows.length === 0) return;
  const supabase = getSupabaseAdmin();
  const payload = rows.map((row) => ({
    platform: row.platform,
    connection_id: row.connectionId,
    insight_date: row.insightDate,
    period: row.period,
    views: row.views,
    impressions: row.impressions,
    reach: row.reach,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    saves: row.saves,
    content_interactions: row.contentInteractions,
    profile_visits: row.profileVisits,
    link_clicks: row.linkClicks,
    follows: row.follows,
    follower_count: row.followerCount,
    watch_time_minutes: row.watchTimeMinutes,
    average_view_duration_seconds: row.averageViewDurationSeconds,
    subscribers_gained: row.subscribersGained,
    subscribers_lost: row.subscribersLost,
    following_count: row.followingCount ?? null,
    profile_likes_count: row.profileLikesCount ?? null,
    video_count: row.videoCount ?? null,
    raw_payload: row.rawPayload,
  }) as never);
  const { error } = await supabase.from("platform_daily_insights").upsert(payload, {
    onConflict: "platform,connection_id,insight_date,period",
  });

  if (!error) {
    return;
  }

  if (!isSchemaSetupError(error)) {
    assertNoError(error);
  }

  const legacyPayload = rows.map((row) => ({
    platform: row.platform,
    connection_id: row.connectionId,
    insight_date: row.insightDate,
    period: row.period,
    views: row.views,
    impressions: row.impressions,
    reach: row.reach,
    content_interactions: row.contentInteractions,
    profile_visits: row.profileVisits,
    link_clicks: row.linkClicks,
    follows: row.follows,
    follower_count: row.followerCount,
    raw_payload: row.rawPayload,
  }) as never);
  const { error: legacyError } = await supabase.from("platform_daily_insights").upsert(
    legacyPayload,
    {
      onConflict: "platform,connection_id,insight_date,period",
    },
  );
  assertNoError(legacyError);
}
