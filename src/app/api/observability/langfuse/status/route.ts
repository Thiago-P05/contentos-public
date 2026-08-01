import { getLangfuseStatus } from "@/lib/observability/langfuse";
import {
  enforceApiRouteSecurity,
  getErrorStatus,
  getPublicErrorMessage,
  logRouteError,
} from "@/lib/request-security";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await enforceApiRouteSecurity(request, {
      bucket: "langfuse-status",
      rateLimit: { limit: 30, windowSeconds: 60 },
      requireOrigin: false,
    });

    return NextResponse.json(getLangfuseStatus());
  } catch (error) {
    logRouteError("api-langfuse-status", error);
    return NextResponse.json(
      { error: getPublicErrorMessage(error, "No se pudo obtener el estado de observabilidad.") },
      { status: getErrorStatus(error) },
    );
  }
}
