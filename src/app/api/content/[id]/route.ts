import { getContentDetail } from "@/lib/supabase/repository";
import {
  enforceApiRouteSecurity,
  getErrorStatus,
  getPublicErrorMessage,
  logRouteError,
} from "@/lib/request-security";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, { params }: RouteProps) {
  const { id } = await params;

  try {
    await enforceApiRouteSecurity(request, {
      bucket: "content-detail",
      rateLimit: { limit: 120, windowSeconds: 60 },
      requireOrigin: false,
    });

    const payload = await getContentDetail(id);

    if (!payload) {
      return NextResponse.json({ error: "Contenido no encontrado." }, { status: 404 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    logRouteError("api-content-detail", error);
    return NextResponse.json(
      {
        error: getPublicErrorMessage(error, "No se pudo obtener el detalle."),
      },
      { status: getErrorStatus(error) },
    );
  }
}
