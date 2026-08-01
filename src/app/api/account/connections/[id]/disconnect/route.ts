import { revokeTikTokToken, revokeYouTubeToken } from "@/lib/oauth";
import {
  deletePlatformConnectionAndData,
  disconnectPlatformConnection,
  getPlatformConnectionCredentials,
} from "@/lib/supabase/repository";
import { enforceApiRouteSecurity, logRouteError } from "@/lib/request-security";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  const { id } = await params;

  try {
    await enforceApiRouteSecurity(request, {
      bucket: "connection-disconnect",
      rateLimit: { limit: 10, windowSeconds: 300 },
    });

    const connection = await getPlatformConnectionCredentials(id);

    if (connection?.platform === "youtube") {
      try {
        await revokeYouTubeToken(connection.refreshToken ?? connection.accessToken);
      } catch (revokeError) {
        logRouteError("api-youtube-token-revoke", revokeError);
      }

      await deletePlatformConnectionAndData(id);
    } else if (connection?.platform === "tiktok") {
      try {
        await revokeTikTokToken(connection.accessToken);
      } catch (revokeError) {
        logRouteError("api-tiktok-token-revoke", revokeError);
      }

      // Keep imported performance history while making all credentials unusable.
      await disconnectPlatformConnection(id);
    } else {
      await disconnectPlatformConnection(id);
    }

    return NextResponse.redirect(new URL("/account?disconnected=1", request.url), 303);
  } catch (error) {
    logRouteError("api-connection-disconnect", error);
    return NextResponse.redirect(
      new URL("/account?error=disconnect", request.url),
      303,
    );
  }
}
