import { NextRequest, NextResponse } from "next/server";
import { normalizeRedirectPath } from "@/lib/auth";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = normalizeRedirectPath(url.searchParams.get("next"));

  if (!code) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "callback");
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  const supabase = createRouteHandlerSupabaseClient(request, response);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "callback");
    return NextResponse.redirect(loginUrl);
  }

  return response;
}