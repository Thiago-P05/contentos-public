import { NextResponse } from "next/server";
import { disconnectTikTokConnectionByExternalId } from "@/lib/supabase/repository";
import {
  getTikTokAuthorizationRemovedOpenId,
  verifyTikTokWebhookSignature,
} from "@/lib/tiktok-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("TikTok-Signature");

  if (!verifyTikTokWebhookSignature(signature, rawBody)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const openId = getTikTokAuthorizationRemovedOpenId(payload);
  if (openId) {
    await disconnectTikTokConnectionByExternalId(openId);
  }

  return NextResponse.json({ ok: true });
}
