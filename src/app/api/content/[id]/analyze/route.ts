import {
  enforceApiRouteSecurity,
  getErrorStatus,
  getPublicErrorMessage,
  logRouteError,
} from "@/lib/request-security";
import { runManualContentAnalysis } from "@/lib/manual-content-analysis";
import { SecurityError } from "@/lib/security-error";
import { getContentDetail } from "@/lib/supabase/repository";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  try {
    await enforceApiRouteSecurity(request, {
      bucket: "manual-content-analysis",
      rateLimit: { limit: 8, windowSeconds: 300 },
    });

    const { id } = await params;
    if (!z.uuid().safeParse(id).success) {
      throw new SecurityError(400, "Contenido invalido.");
    }

    const detail = await getContentDetail(id);
    if (!detail) {
      throw new SecurityError(404, "Contenido no encontrado.");
    }

    if (detail.item.analysisStatus === "ready" || detail.item.analysisStatus === "fallback") {
      throw new SecurityError(409, "Este contenido ya tiene un analisis listo.");
    }

    const result = await runManualContentAnalysis(detail.item);
    if (!result.claimed) {
      throw new SecurityError(
        409,
        result.reason === "transcription_processing"
          ? "La transcripcion de este contenido sigue en proceso. Intenta nuevamente en unos minutos."
          : "Este contenido ya se esta analizando.",
      );
    }

    return NextResponse.json({
      transcription: {
        eligible: result.transcription.eligible,
        attempted: result.transcription.attempted,
        outcome: result.transcription.outcome,
      },
      analysis: {
        attempted: result.analysis.attempted,
        outcome: result.analysis.outcome,
      },
    });
  } catch (error) {
    logRouteError("api-manual-content-analysis", error);
    return NextResponse.json(
      { error: getPublicErrorMessage(error, "No se pudo analizar el contenido.") },
      { status: getErrorStatus(error) },
    );
  }
}
