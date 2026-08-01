import { NextRequest, NextResponse } from "next/server";
import { assertAllowedOrigin } from "@/lib/request-security";
import { isAllowedSupabaseUser } from "@/lib/server-auth";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertAllowedOrigin(request);
    const formData = await request.formData();
    const authorizationId = formData.get("authorization_id");
    const decision = formData.get("decision");

    if (typeof authorizationId !== "string" || !authorizationId || (decision !== "approve" && decision !== "deny")) {
      return NextResponse.json({ error: "Invalid authorization decision." }, { status: 400 });
    }

    const response = NextResponse.next();
    const supabase = createRouteHandlerSupabaseClient(request, response);
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !isAllowedSupabaseUser(userData.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = decision === "approve"
      ? await supabase.auth.oauth.approveAuthorization(authorizationId)
      : await supabase.auth.oauth.denyAuthorization(authorizationId);

    if (error || !data?.redirect_url) {
      return NextResponse.json({ error: error?.message ?? "Unable to process authorization." }, { status: 400 });
    }

    // 303 y no el 307 por defecto: el navegador llega aca por un form POST y el
    // callback OAuth del cliente solo acepta GET. Con 307 se reenvia el POST y
    // claude.ai responde "Method Not Allowed".
    const redirectResponse = NextResponse.redirect(data.redirect_url, 303);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  } catch (error) {
    console.error("[oauth-decision]", error);
    return NextResponse.json({ error: "Unable to process authorization." }, { status: 500 });
  }
}
