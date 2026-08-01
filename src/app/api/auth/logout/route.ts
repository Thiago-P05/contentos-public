import { NextRequest, NextResponse } from "next/server";
import {
  enforceApiRouteSecurity,
  getErrorStatus,
  getPublicErrorMessage,
  logRouteError,
} from "@/lib/request-security";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    await enforceApiRouteSecurity(request, {
      bucket: "auth-logout",
      rateLimit: { limit: 20, windowSeconds: 300 },
    });

    const response = NextResponse.redirect(new URL("/login", request.url));
    const supabase = createRouteHandlerSupabaseClient(request, response);
    await supabase.auth.signOut();
    return response;
  } catch (error) {
    logRouteError("api-auth-logout", error);
    return NextResponse.json(
      { error: getPublicErrorMessage(error, "No se pudo cerrar sesion.") },
      { status: getErrorStatus(error) },
    );
  }
}
