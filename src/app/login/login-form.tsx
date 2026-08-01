"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginFormProps = { next: string; initialError: string | null; setupMissing: string[]; };

function formatAuthError(message: string) {
  if (/invalid login credentials/i.test(message)) return "Email o contrasena invalidos.";
  return message;
}

export function LoginForm({ next, initialError, setupMissing }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const setupMessage = setupMissing.length ? `Faltan ${setupMissing.join(", ")} en .env.local para activar Supabase Auth.` : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (setupMessage) { setErrorMessage(setupMessage); return; }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setErrorMessage(formatAuthError(error.message)); return; }
      router.replace(next);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo completar la autenticacion.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="ds-card ds-animate-in w-full max-w-[460px] rounded-xl px-7 py-8 sm:px-9">
        <div className="space-y-3">
          <p className="ds-label">Acceso</p>
          <h1 className="text-4xl font-semibold leading-none tracking-display text-foreground sm:text-[3.2rem]">Seguridad real</h1>
          <p className="max-w-[38ch] text-sm leading-6 text-muted-foreground">Inicia sesion con tu cuenta autorizada usando email y contrasena.</p>
        </div>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <Label className="block space-y-2">
            <span className="ds-label">Email</span>
            <Input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              className="h-11 px-4 text-sm"
              placeholder="tu@email.com"
              disabled={isSubmitting}
              required
            />
          </Label>
          <Label className="block space-y-2">
            <span className="ds-label">Contrasena</span>
            <Input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              className="h-11 px-4 text-sm"
              placeholder="Tu contrasena"
              disabled={isSubmitting}
              required
            />
          </Label>
          {errorMessage ? <p className="rounded-md bg-danger-bg px-4 py-3 text-sm text-danger">{errorMessage}</p> : null}
          {setupMessage ? <p className="rounded-md bg-surface-elevated px-4 py-3 text-sm text-muted-foreground">{setupMessage}</p> : null}
          <Button type="submit" size="lg" disabled={isSubmitting || Boolean(setupMessage)} className="w-full">
            {isSubmitting ? "Procesando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}

