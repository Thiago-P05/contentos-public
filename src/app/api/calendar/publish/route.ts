import { NextRequest, NextResponse } from "next/server";
import {
  enforceApiRouteSecurity,
  getErrorStatus,
  getPublicErrorMessage,
  logRouteError,
} from "@/lib/request-security";

export async function POST(req: NextRequest) {
  try {
    await enforceApiRouteSecurity(req, {
      bucket: "calendar-publish",
      rateLimit: { limit: 10, windowSeconds: 300 },
    });

    const formData = await req.formData();
    
    const fileName = formData.get("fileName") as string | null;
    const accountId = formData.get("accountId") as string | null;
    if (!fileName || !accountId) {
      return NextResponse.json(
        { error: "Archivo o cuenta destino principal faltante" },
        { status: 400 }
      );
    }

    /*
     * SIMULACIÓN DE PROCESAMIENTO
     * 1. Subir a Supabase Storage (Bucket 'media')
     * 2. Insertar ContentItem en Supabase DB con status 'draft' o 'scheduled'
     * 3. (Opcional) Llamar a Meta API o TikTok API si es 'published' ahora.
     * 
     * Se emula una demora de subida para propósitos visuales:
     */
    await new Promise((resolve) => setTimeout(resolve, 2500));

    return NextResponse.json({
      success: true,
      message: "Publicación agendada exitosamente",
    });

  } catch (error) {
    logRouteError("api-calendar-publish", error);
    return NextResponse.json(
      { error: getPublicErrorMessage(error, "Error procesando el archivo multimedia") },
      { status: getErrorStatus(error) }
    );
  }
}
