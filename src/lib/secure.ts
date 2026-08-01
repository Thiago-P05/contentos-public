import { env } from "@/lib/env";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

function toBase64Url(value: Buffer) {
  return value.toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

function toKey(secret: string) {
  return createHash("sha256").update(secret).digest();
}

function getSecretKey() {
  const secret = env.CONNECTION_ENCRYPTION_SECRET ?? env.AUTH_SECRET;

  if (!secret) {
    throw new Error("Missing environment variable: CONNECTION_ENCRYPTION_SECRET");
  }

  return toKey(secret);
}

function getCandidateKeys(): Buffer[] {
  if (env.CONNECTION_ENCRYPTION_SECRET) return [toKey(env.CONNECTION_ENCRYPTION_SECRET)];
  if (env.AUTH_SECRET) return [toKey(env.AUTH_SECRET)];
  throw new Error("Missing environment variable: CONNECTION_ENCRYPTION_SECRET");
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const key = getSecretKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map(toBase64Url).join(".");
}

export function decryptSecret(value: string) {
  const [ivSegment, tagSegment, encryptedSegment] = value.split(".");

  if (!ivSegment || !tagSegment || !encryptedSegment) {
    throw new Error("Encrypted secret has an invalid format.");
  }

  const iv = fromBase64Url(ivSegment);
  const tag = fromBase64Url(tagSegment);
  const encrypted = fromBase64Url(encryptedSegment);

  for (const key of getCandidateKeys()) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    } catch (err) {
      const isAuthFailure =
        err instanceof Error && /bad decrypt|EVP_DecryptFinal|authentication tag/i.test(err.message);
      if (!isAuthFailure) throw err;
    }
  }

  throw new Error("Unable to decrypt secret: no matching key found.");
}

export function createSignedPayload(payload: Record<string, unknown>) {
  const body = toBase64Url(Buffer.from(JSON.stringify(payload)));
  const signature = createHmac("sha256", getSecretKey()).update(body).digest("base64url");

  return `${body}.${signature}`;
}

export function verifySignedPayload<T>(value: string): T | null {
  const [body, signature] = value.split(".");

  if (!body || !signature) {
    return null;
  }

  const expectedSignature = createHmac("sha256", getSecretKey()).update(body).digest("base64url");

  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function getAbsoluteAppUrl(pathname: string, baseUrl?: string) {
  const origin = baseUrl ?? env.APP_URL;

  if (!origin) {
    throw new Error("Missing environment variable: APP_URL");
  }

  return new URL(pathname, origin).toString();
}
