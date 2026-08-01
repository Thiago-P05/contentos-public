import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { SecurityError } from "@/lib/security-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export function isAllowedSupabaseUser(user: Pick<User, "id" | "email"> | null | undefined) {
  if (!user) {
    return false;
  }

  const allowedUserId = env.ALLOWED_USER_ID?.trim();
  const allowedUserEmail = env.ALLOWED_USER_EMAIL?.trim().toLowerCase();

  if (allowedUserId && user.id === allowedUserId) {
    return true;
  }

  if (allowedUserEmail && user.email?.trim().toLowerCase() === allowedUserEmail) {
    return true;
  }

  return false;
}

const getAllowedUser = cache(async () => {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims as { sub?: unknown; email?: unknown } | null;
    const user =
      typeof claims?.sub === "string"
        ? {
            id: claims.sub,
            ...(typeof claims.email === "string" ? { email: claims.email } : {}),
          }
        : null;

    if (error || !isAllowedSupabaseUser(user)) {
      return null;
    }

    return user;
  } catch (err) {
    console.error("[server-auth] Error al obtener el usuario:", err);
    throw new SecurityError(503, "Error de autenticacion. Intenta nuevamente.");
  }
});

export async function requireAllowedUser() {
  if (!(env.ALLOWED_USER_ID || env.ALLOWED_USER_EMAIL)) {
    throw new SecurityError(503, "Configuracion de seguridad incompleta.");
  }

  const user = await getAllowedUser();

  if (!user) {
    throw new SecurityError(401, "Unauthorized");
  }

  return user;
}

export async function requireAllowedPageUser() {
  try {
    await requireAllowedUser();
  } catch (err) {
    if (err instanceof SecurityError && err.status === 503) throw err;
    redirect("/login");
  }
}
