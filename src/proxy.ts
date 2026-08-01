import { NextResponse, type NextRequest } from "next/server";
import { normalizeRedirectPath } from "@/lib/auth";
import { createProxySupabaseClient } from "@/lib/supabase/server";

const PUBLIC_FILE_PATTERN = /\.[^/]+$/;

function hasSupabaseAuthConfig() {
  return Boolean((process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL) && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function isAllowedSupabaseUser(user: { id: string; email?: string | null } | null | undefined) {
  if (!user) {
    return false;
  }

  const allowedUserId = process.env.ALLOWED_USER_ID?.trim();
  const allowedUserEmail = process.env.ALLOWED_USER_EMAIL?.trim().toLowerCase();

  if (allowedUserId && user.id === allowedUserId) {
    return true;
  }

  if (allowedUserEmail && user.email?.trim().toLowerCase() === allowedUserEmail) {
    return true;
  }

  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname === "/favicon.ico" || PUBLIC_FILE_PATTERN.test(pathname)) {
    return NextResponse.next();
  }

  const isLoginRoute = pathname === "/login";
  const isAuthCallbackRoute = pathname.startsWith("/auth/callback");
  const isTikTokWebhookRoute = pathname === "/api/webhooks/tiktok";
  const isMcpRoute = pathname === "/mcp" || pathname === "/.well-known/oauth-protected-resource/mcp";
  const isApiRoute = pathname.startsWith("/api/");

  if (!hasSupabaseAuthConfig()) {
    if (isLoginRoute || isAuthCallbackRoute || isTikTokWebhookRoute || isMcpRoute) {
      return NextResponse.next();
    }

    if (isApiRoute) {
      return NextResponse.json({ error: "Supabase Auth no configurado" }, { status: 503 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "setup");
    return NextResponse.redirect(loginUrl);
  }

  // TikTok signs this request itself; it cannot carry a browser session.
  if (isTikTokWebhookRoute) {
    return NextResponse.next();
  }

  // MCP uses OAuth bearer tokens rather than the browser's Supabase cookies.
  if (isMcpRoute) {
    return NextResponse.next();
  }

  const responseRef = { current: NextResponse.next({ request }) };
  const supabase = createProxySupabaseClient(request, responseRef);
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as { sub?: unknown; email?: unknown } | null;
  const user =
    typeof claims?.sub === "string"
      ? {
          id: claims.sub,
          ...(typeof claims.email === "string" ? { email: claims.email } : {}),
        }
      : null;
  const isAuthenticated = !error && isAllowedSupabaseUser(user);

  if (user && !error && !isAllowedSupabaseUser(user)) {
    await supabase.auth.signOut();
  }

  if (isLoginRoute) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return responseRef.current;
  }

  if (isAuthCallbackRoute) {
    return responseRef.current;
  }

  if (isAuthenticated) {
    return responseRef.current;
  }

  if (isApiRoute) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  if (user && !error && !isAllowedSupabaseUser(user)) {
    loginUrl.searchParams.set("error", "unauthorized");
  }
  loginUrl.searchParams.set("next", normalizeRedirectPath(`${pathname}${search}`));
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
