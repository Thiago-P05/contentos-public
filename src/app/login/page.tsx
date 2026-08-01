import type { Metadata } from "next";
import { normalizeRedirectPath } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Acceso seguro | Content OS",
};

const messages: Record<string, string> = {
  callback: "No se pudo completar la verificacion del email. Volve a intentar desde el enlace mas reciente.",
  setup: "Falta configurar Supabase Auth para poder iniciar sesion.",
  unauthorized: "Tu cuenta no esta autorizada para usar esta aplicacion.",
};

function getAuthSetupMissingKeys() {
  const missing: string[] = [];

  if (!(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return missing;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = normalizeRedirectPath(params.next);
  const setupMissing = getAuthSetupMissingKeys();
  const initialError =
    params.error === "setup" && setupMissing.length === 0
      ? null
      : params.error
        ? messages[params.error] ?? "No se pudo iniciar sesion."
        : null;

  return <LoginForm next={next} initialError={initialError} setupMissing={setupMissing} />;
}
