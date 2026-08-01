import { runDashboardSync, runFullSync } from "@/lib/sync/run-full-sync";
import {
  enforceApiRouteSecurity,
  getErrorStatus,
  getPublicErrorMessage,
  logRouteError,
} from "@/lib/request-security";
import type { PlatformFilter } from "@/lib/types";
import { normalizePlatform } from "@/lib/platforms";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await enforceApiRouteSecurity(request, {
      bucket: "sync-run",
      rateLimit: { limit: 6, windowSeconds: 300 },
    });

    const payload =
      request.headers.get("content-type")?.includes("application/json")
        ? ((await request.json()) as {
            platform?: string;
            connectionId?: string | null;
            mode?: string;
          })
        : {};

    const filters: {
      platform: PlatformFilter;
      connectionId: string | null;
    } = {
      platform: normalizePlatform(payload.platform) ?? "all",
      connectionId:
        typeof payload.connectionId === "string" && payload.connectionId.trim()
          ? payload.connectionId
          : null,
    };

    const result =
      payload.mode === "dashboard"
        ? await runDashboardSync(filters)
        : await runFullSync(filters);
    const syncLabel =
      payload.mode === "dashboard" ? "Refresh de dashboard completado" : "Sincronizacion completada";

    return NextResponse.json({
      message: `${syncLabel}. Cuentas procesadas: ${result.results
        .map((entry) => `${entry.platform}${entry.displayName ? ` (${entry.displayName})` : ""}`)
        .join(", ")}.`,
      result,
      warnings: result.warnings,
    });
  } catch (error) {
    logRouteError("api-sync-run", error);
    return NextResponse.json(
      {
        error: getPublicErrorMessage(error, "No se pudo ejecutar la sincronizacion."),
      },
      { status: getErrorStatus(error) },
    );
  }
}
