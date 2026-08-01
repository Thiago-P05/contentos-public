import {
  normalizeDashboardAnchor,
  normalizeDashboardRange,
} from "@/lib/dashboard-range";
import { normalizePlatformFilter } from "@/lib/platforms";
import {
  enforceApiRouteSecurity,
  getErrorStatus,
  getPublicErrorMessage,
  logRouteError,
} from "@/lib/request-security";
import { getDashboardOverview } from "@/lib/supabase/repository";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await enforceApiRouteSecurity(request, {
      bucket: "dashboard-overview",
      rateLimit: { limit: 120, windowSeconds: 60 },
      requireOrigin: false,
    });

    const { searchParams } = new URL(request.url);
    const payload = await getDashboardOverview(
      normalizeDashboardRange(searchParams.get("range")),
      normalizePlatformFilter(searchParams.get("platform")),
      searchParams.get("connection"),
      normalizeDashboardAnchor(searchParams.get("anchor")),
    );
    return NextResponse.json(payload);
  } catch (error) {
    logRouteError("api-dashboard-overview", error);
    return NextResponse.json(
      {
        error: getPublicErrorMessage(error, "No se pudo obtener el overview."),
      },
      { status: getErrorStatus(error) },
    );
  }
}
