import { z } from "zod";
import type { VideoPotentialEstimate } from "@/lib/types";

function normalizeRange(values: { low: number; expected: number; high: number }) {
  const low = Math.max(0, Math.round(values.low));
  const expected = Math.max(0, Math.round(values.expected));
  const high = Math.max(0, Math.round(values.high));
  const ordered = [low, expected, high].sort((left, right) => left - right);

  return {
    low: ordered[0] ?? 0,
    expected: ordered[1] ?? 0,
    high: ordered[2] ?? 0,
  };
}

const potentialRangeSchema = z
  .object({
    low: z.coerce.number().finite().nonnegative(),
    expected: z.coerce.number().finite().nonnegative(),
    high: z.coerce.number().finite().nonnegative(),
  })
  .transform(normalizeRange);

export const videoPotentialSchema = z
  .object({
    horizonDays: z.coerce.number().optional().default(7),
    views: potentialRangeSchema,
    reach: potentialRangeSchema,
    comments: potentialRangeSchema,
    confidence: z.coerce.number().finite().min(0).max(1).default(0.5),
    rationale: z.string().trim().default(""),
  })
  .transform((value): VideoPotentialEstimate => ({
    horizonDays: 7,
    views: value.views,
    reach: value.reach,
    comments: value.comments,
    confidence: value.confidence,
    rationale: value.rationale,
  }));

export function parseVideoPotentialEstimate(value: unknown) {
  const parsed = videoPotentialSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function getVideoPotentialFromPayload(rawPayload: Record<string, unknown>) {
  return (
    parseVideoPotentialEstimate(rawPayload.videoPotential) ??
    parseVideoPotentialEstimate(
      typeof rawPayload.parsed === "object" && rawPayload.parsed !== null
        ? (rawPayload.parsed as Record<string, unknown>).videoPotential
        : null,
    )
  );
}
