import { listContentCatalog } from "@/lib/supabase/repository";
import {
  enforceApiRouteSecurity,
  getErrorStatus,
  getPublicErrorMessage,
  logRouteError,
} from "@/lib/request-security";
import { NextRequest, NextResponse } from "next/server";
import { normalizePlatform } from "@/lib/platforms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await enforceApiRouteSecurity(request, {
      bucket: "content-catalog",
      rateLimit: { limit: 120, windowSeconds: 60 },
      requireOrigin: false,
    });

    const searchParams = request.nextUrl.searchParams;
    const rawLimit = Number(searchParams.get("limit"));
    const rawOffset = Number(searchParams.get("offset"));
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.trunc(rawLimit) : undefined;
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.trunc(rawOffset) : undefined;

    const payload = await listContentCatalog({
      platform: normalizePlatform(searchParams.get("platform")) ?? "all",
      query: searchParams.get("q") ?? undefined,
      limit,
      offset,
    });

    return NextResponse.json(payload);
  } catch (error) {
    logRouteError("api-content-catalog", error);
    return NextResponse.json(
      {
        error: getPublicErrorMessage(error, "No se pudo listar contenido."),
      },
      { status: getErrorStatus(error) },
    );
  }
}
