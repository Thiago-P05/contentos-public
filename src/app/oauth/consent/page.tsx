import { redirect } from "next/navigation";
import { isAllowedSupabaseUser } from "@/lib/server-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

type AuthorizationDetails = {
  authorization_id?: string;
  redirect_url?: string;
  client?: { name?: string; client_id?: string };
  redirect_uri?: string;
  scope?: string;
};

export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>;
}) {
  const { authorization_id: authorizationId } = await searchParams;

  if (!authorizationId) {
    return <main className="mx-auto flex min-h-screen max-w-xl items-center px-6"><p className="text-sm text-muted-foreground">Solicitud de autorizacion invalida.</p></main>;
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!isAllowedSupabaseUser(userData.user)) {
    redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`)}`);
  }

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  const details = data as AuthorizationDetails | null;

  if (error || !details) {
    return <main className="mx-auto flex min-h-screen max-w-xl items-center px-6"><p className="text-sm text-muted-foreground">La solicitud expiro o ya no es valida.</p></main>;
  }

  if (!details.authorization_id && details.redirect_url) {
    redirect(details.redirect_url);
  }

  const scopes = details.scope?.split(" ").filter(Boolean) ?? [];
  const redirectHost = details.redirect_uri ? new URL(details.redirect_uri).host : "cliente desconocido";

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-12">
      <section className="ds-card w-full rounded-xl p-7 sm:p-10">
        <p className="ds-label">MCP Access</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-display text-foreground">Conectar agente</h1>
        <p className="mt-4 max-w-[48ch] text-sm leading-6 text-muted-foreground">
          <strong className="font-medium text-foreground">{details.client?.name ?? "Un agente externo"}</strong> solicita acceso de solo lectura a tus datos de ContentOS.
        </p>
        <dl className="mt-8 space-y-4 rounded-lg border border-border bg-surface-elevated p-5 text-sm">
          <div><dt className="font-mono text-label uppercase tracking-caps text-muted-foreground">Cliente</dt><dd className="mt-1 text-foreground">{details.client?.name ?? details.client?.client_id ?? "Desconocido"}</dd></div>
          <div><dt className="font-mono text-label uppercase tracking-caps text-muted-foreground">Destino</dt><dd className="mt-1 break-all text-foreground">{redirectHost}</dd></div>
          <div><dt className="font-mono text-label uppercase tracking-caps text-muted-foreground">Permisos</dt><dd className="mt-2 flex flex-wrap gap-2">{scopes.length ? scopes.map((scope) => <span key={scope} className="rounded-full bg-background px-3 py-1 font-mono text-caption text-foreground">{scope}</span>) : <span className="text-muted-foreground">Sin permisos declarados</span>}</dd></div>
        </dl>
        <p className="mt-5 text-xs leading-5 text-muted-foreground">El agente puede leer briefs, metricas, analisis y transcripciones. No puede editar, publicar ni acceder a credenciales de cuentas.</p>
        <form action="/api/oauth/decision" method="POST" className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <input type="hidden" name="authorization_id" value={details.authorization_id ?? authorizationId} />
          <Button name="decision" value="deny" variant="secondary" size="lg">Cancelar</Button>
          <Button name="decision" value="approve" size="lg">Autorizar acceso</Button>
        </form>
      </section>
    </main>
  );
}
