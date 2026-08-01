import { generateCompetitionReport } from "@/lib/competition/analysis";
import { fetchCompetitorInstagramProfileFromApify } from "@/lib/competition/apify";
import {
  buildCompetitionWindowAggregate,
  getTopCompetitorPostsByComments,
  getTopCompetitorPostsByViews,
} from "@/lib/competition/metrics";
import type {
  CompetitionAnalysisDetail,
  CompetitorContentSnapshot,
} from "@/lib/competition/types";
import {
  InvalidCompetitionProfileUrlError,
  normalizeInstagramProfileUrl,
} from "@/lib/competition/url";
import { getCompetitionMissingEnvKeys } from "@/lib/env";
import { withLangfuseSpan } from "@/lib/observability/langfuse";
import {
  createCompetitorAnalysisRun,
  finishCompetitorAnalysisRun,
  getCompetitorAnalysisDetail,
  upsertCompetitorContentSnapshots,
  upsertCompetitorProfile,
} from "@/lib/supabase/repository";

export class CompetitionHttpError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "CompetitionHttpError";
    this.statusCode = statusCode;
  }
}

function toSnapshotModel(
  runId: string,
  posts: Array<{
    externalPostId: string;
    permalink: string | null;
    caption: string | null;
    mediaType: CompetitorContentSnapshot["mediaType"];
    publishedAt: string | null;
    thumbnailUrl: string | null;
    likeCount: number | null;
    commentCount: number | null;
    viewCount: number | null;
    rawPayload: Record<string, unknown>;
  }>,
): CompetitorContentSnapshot[] {
  const createdAt = new Date().toISOString();

  return posts.map((post, index) => ({
    id: `${runId}:${post.externalPostId}:${index}`,
    analysisRunId: runId,
    externalPostId: post.externalPostId,
    permalink: post.permalink,
    caption: post.caption,
    mediaType: post.mediaType,
    publishedAt: post.publishedAt,
    thumbnailUrl: post.thumbnailUrl,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    viewCount: post.viewCount,
    rawPayload: post.rawPayload,
    createdAt,
  }));
}

function normalizeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo completar el análisis.";
}

function toAnalysisError(error: unknown) {
  if (error instanceof CompetitionHttpError) {
    return error;
  }

  if (error instanceof InvalidCompetitionProfileUrlError) {
    return new CompetitionHttpError(error.message, 400);
  }

  const message = normalizeErrorMessage(error);

  if (
    /privado|private|not found|no se pudo analizar|no se encontraron publicaciones|inaccesible/i.test(
      message,
    )
  ) {
    return new CompetitionHttpError(message, 422);
  }

  if (/apify|openrouter|upstream|provider/i.test(message)) {
    return new CompetitionHttpError(message, 502);
  }

  return new CompetitionHttpError(message, 500);
}

export async function runCompetitionAnalysis(profileUrl: string): Promise<CompetitionAnalysisDetail> {
  const missingEnv = getCompetitionMissingEnvKeys();

  if (missingEnv.length > 0) {
    throw new CompetitionHttpError(
      `Falta configuración para competencia: ${missingEnv.join(", ")}.`,
      500,
    );
  }

  const { username, normalizedUrl } = normalizeInstagramProfileUrl(profileUrl);
  const seededProfile = await upsertCompetitorProfile({
    platform: "instagram",
    username,
    sourceUrl: normalizedUrl,
    displayName: null,
    biography: null,
    profileImageUrl: null,
    followerCount: null,
    followingCount: null,
    postsCount: null,
    rawPayload: {
      seededFrom: "competition_mvp",
      requestedUrl: profileUrl,
    },
  });
  const run = await createCompetitorAnalysisRun({
    profileId: seededProfile.id,
    requestedUrl: normalizedUrl,
    sourceProvider: "apify",
    rawPayload: {
      stage: "created",
      username,
      requestedUrl: profileUrl,
      normalizedUrl,
    },
  });

  try {
    const dataset = await withLangfuseSpan(
      {
        name: "competition.apify.fetch_profile",
        input: { username, normalizedUrl },
        metadata: { provider: "apify", agentType: "competition_analysis", username },
        output: (result) => ({
          posts: result.posts.length,
          username: result.profile.username,
          sourceProvider: result.sourceProvider,
        }),
      },
      () => fetchCompetitorInstagramProfileFromApify(normalizedUrl, username),
    );

    if (dataset.posts.length === 0) {
      throw new CompetitionHttpError(
        "No se encontraron publicaciones públicas suficientes para analizar este perfil.",
        422,
      );
    }

    const profile = await withLangfuseSpan(
      {
        name: "competition.persist_profile",
        input: { username: dataset.profile.username },
        metadata: { agentType: "competition_analysis", runId: run.id },
        output: (result) => ({ profileId: result.id, username: result.username }),
      },
      () => upsertCompetitorProfile(dataset.profile),
    );
    await withLangfuseSpan(
      {
        name: "competition.persist_posts",
        input: { runId: run.id, posts: dataset.posts.length },
        metadata: { agentType: "competition_analysis", runId: run.id },
        output: () => ({ posts: dataset.posts.length }),
      },
      () => upsertCompetitorContentSnapshots(run.id, dataset.posts),
    );

    const snapshotModels = toSnapshotModel(run.id, dataset.posts);
    const aggregates30d = buildCompetitionWindowAggregate(snapshotModels);
    const topByViews = getTopCompetitorPostsByViews(snapshotModels);
    const topByComments = getTopCompetitorPostsByComments(snapshotModels);
    const report = await generateCompetitionReport({
      profile,
      posts: snapshotModels,
      aggregates30d,
      topByViews,
      topByComments,
    });

    await finishCompetitorAnalysisRun(run.id, {
      status: "completed",
      reportPayload: report,
      rawPayload: {
        stage: "completed",
        dataset: dataset.rawPayload,
        profileRawPayload: dataset.profile.rawPayload,
        reportRawPayload: report.rawPayload,
      },
    });

    const detail = await getCompetitorAnalysisDetail(run.id);

    if (!detail) {
      throw new CompetitionHttpError(
        "El análisis se guardó, pero no se pudo reconstruir el detalle final.",
        500,
      );
    }

    return detail;
  } catch (error) {
    const normalizedError = toAnalysisError(error);

    await finishCompetitorAnalysisRun(run.id, {
      status: "failed",
      errorMessage: normalizedError.message,
      rawPayload: {
        stage: "failed",
        username,
        normalizedUrl,
        error: normalizedError.message,
        statusCode: normalizedError.statusCode,
      },
    }).catch(() => undefined);

    throw normalizedError;
  }
}
