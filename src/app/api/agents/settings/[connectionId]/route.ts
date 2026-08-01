import { z } from "zod";
import {
  enforceApiRouteSecurity,
  getErrorStatus,
  getPublicErrorMessage,
  logRouteError,
} from "@/lib/request-security";
import { SecurityError } from "@/lib/security-error";
import { updatePlatformConnectionAgentSettings } from "@/lib/supabase/repository";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  autoAnalysisEnabled: z.boolean(),
  autoTranscriptionEnabled: z.boolean(),
});

type RouteProps = {
  params: Promise<{
    connectionId: string;
  }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  try {
    await enforceApiRouteSecurity(request, {
      bucket: "agent-settings",
      rateLimit: { limit: 20, windowSeconds: 300 },
    });

    const { connectionId } = await params;
    if (!z.uuid().safeParse(connectionId).success) {
      throw new SecurityError(400, "Conexion invalida.");
    }

    const parsed = settingsSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new SecurityError(400, "Configuracion de agentes invalida.");
    }

    const connection = await updatePlatformConnectionAgentSettings(connectionId, parsed.data);
    if (!connection) {
      throw new SecurityError(404, "Conexion no encontrada.");
    }

    return NextResponse.json({
      settings: {
        autoAnalysisEnabled: connection.autoAnalysisEnabled !== false,
        autoTranscriptionEnabled: connection.autoTranscriptionEnabled !== false,
      },
    });
  } catch (error) {
    logRouteError("api-agent-settings", error);
    return NextResponse.json(
      { error: getPublicErrorMessage(error, "No se pudo guardar la configuracion de agentes.") },
      { status: getErrorStatus(error) },
    );
  }
}
