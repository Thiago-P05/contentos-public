import { env } from "@/lib/env";
import { runFullSync } from "@/lib/sync/run-full-sync";
import { logRouteError, getErrorStatus, getPublicErrorMessage } from "@/lib/request-security";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isValidCronAuth(authHeader: string | null, cronSecret: string): boolean {
  const expected = `Bearer ${cronSecret}`;
  const provided = authHeader ?? "";
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function GET(request: Request) {
  const cronSecret = env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || !isValidCronAuth(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runFullSync({ platform: "all", connectionId: null });
    return NextResponse.json({
      message: "Sync completado.",
      processed: result.results.map((r) => r.platform + (r.displayName ? ` (${r.displayName})` : "")),
      warnings: result.warnings,
    });
  } catch (error) {
    logRouteError("api-sync-cron", error);
    return NextResponse.json(
      { error: getPublicErrorMessage(error, "No se pudo ejecutar el sync.") },
      { status: getErrorStatus(error) },
    );
  }
}
