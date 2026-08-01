import { createHmac, timingSafeEqual } from "node:crypto";
import { requireEnvValue } from "@/lib/env";

const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000;

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function parseSignature(value: string) {
  const pairs = value.split(/[,;]/).map((part) => part.trim().split("=", 2));
  const timestamp = pairs.find(([key]) => key === "t" || key === "timestamp")?.[1] ?? null;
  const signature = pairs.find(([key]) => key === "s" || key === "signature")?.[1] ?? null;

  return { timestamp, signature: signature ?? (value.includes("=") ? null : value) };
}

export function verifyTikTokWebhookSignature(
  signatureHeader: string | null,
  rawBody: string,
  now = Date.now(),
) {
  if (!signatureHeader) return false;
  const { timestamp, signature } = parseSignature(signatureHeader);

  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  const timestampMs = Number(timestamp) * (timestamp.length <= 10 ? 1000 : 1);

  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > MAX_WEBHOOK_AGE_MS) {
    return false;
  }

  const expected = createHmac("sha256", requireEnvValue("TIKTOK_CLIENT_SECRET"))
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  return safeEqual(signature.toLowerCase(), expected);
}

export function getTikTokAuthorizationRemovedOpenId(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as Record<string, unknown>;
  const event = value.event ?? value.event_type;

  if (event !== "authorization.removed") return null;
  const user = value.user && typeof value.user === "object" ? value.user as Record<string, unknown> : null;
  const data = value.data && typeof value.data === "object" ? value.data as Record<string, unknown> : null;
  const openId = user?.open_id ?? data?.open_id ?? value.open_id;

  return typeof openId === "string" && openId ? openId : null;
}
