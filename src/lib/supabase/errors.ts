import type { SupabaseErrorLike } from "@/lib/supabase/types";

export const DATABASE_SETUP_ISSUE =
  "Falta correr las migraciones pendientes de Supabase en el proyecto configurado.";

export const SUPABASE_UNAVAILABLE_ISSUE =
  "Supabase no respondió a tiempo. Probá de nuevo en unos minutos.";

function isCloudflareTimeoutMessage(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("error code 522") ||
    normalized.includes("connection timed out") ||
    normalized.includes("cloudflare") && normalized.includes("timed out")
  );
}

function normalizeSupabaseErrorMessage(error: SupabaseErrorLike | string | unknown) {
  const raw =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";

  const message = raw.trim();

  if (!message) {
    return "Error desconocido de Supabase.";
  }

  if (message.startsWith("<!DOCTYPE html") || message.startsWith("<html")) {
    if (isCloudflareTimeoutMessage(message)) {
      return SUPABASE_UNAVAILABLE_ISSUE;
    }

    return "Supabase devolvió una respuesta HTML inesperada.";
  }

  if (isCloudflareTimeoutMessage(message)) {
    return SUPABASE_UNAVAILABLE_ISSUE;
  }

  return message;
}

export function isSchemaSetupErrorMessage(message?: string | null) {
  if (!message) {
    return false;
  }

  return (
    message.includes("Could not find the table") ||
    message.includes("schema cache") ||
    message.includes("relation") ||
    message.includes("does not exist") ||
    message.includes("column")
  );
}

export function isSchemaSetupError(error: SupabaseErrorLike) {
  if (!error) {
    return false;
  }

  return error.code === "PGRST205" || isSchemaSetupErrorMessage(normalizeSupabaseErrorMessage(error));
}

export function isRecoverableSetupError(error: unknown) {
  const message = error instanceof Error ? error.message : normalizeSupabaseErrorMessage(error);
  return (
    error instanceof Error &&
    (message === DATABASE_SETUP_ISSUE || isSchemaSetupErrorMessage(message))
  );
}

export function isTransientSupabaseError(error: unknown) {
  const message = error instanceof Error ? error.message : normalizeSupabaseErrorMessage(error);
  return message === SUPABASE_UNAVAILABLE_ISSUE;
}

export function assertNoError(error: SupabaseErrorLike) {
  if (error) {
    if (isSchemaSetupError(error)) {
      throw new Error(DATABASE_SETUP_ISSUE);
    }

    throw new Error(normalizeSupabaseErrorMessage(error));
  }
}
