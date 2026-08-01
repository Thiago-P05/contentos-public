import { AgentSettingsForm } from "@/components/agent-settings-form";
import { PlatformIcon } from "@/components/platform-icon";
import { getPlatformLabel } from "@/lib/platforms";
import { getMcpDashboardOverview } from "@/lib/mcp/dashboard";
import { requireAllowedPageUser } from "@/lib/server-auth";
import { listPlatformConnections } from "@/lib/supabase/repository";
import type { Platform, PlatformConnection } from "@/lib/types";
import { AudioLines, BrainCircuit, Cable, CircleDot, Link2, ShieldCheck, Users } from "lucide-react";

export const dynamic = "force-dynamic";

function getConnectionLabel(connection: PlatformConnection) {
  return connection.accountUsername ?? connection.displayName ?? connection.accountExternalId;
}

function formatLastSeen(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AgentsPage() {
  await requireAllowedPageUser();
  const [connections, mcp] = await Promise.all([
    listPlatformConnections({
      includeDisconnected: false,
      includeBriefs: false,
    }),
    getMcpDashboardOverview(),
  ]);
  const enabledAutomations = connections.reduce(
    (total, connection) =>
      total +
      Number(connection.autoAnalysisEnabled !== false) +
      Number(connection.autoTranscriptionEnabled !== false),
    0,
  );

  return (
    <div className="flex flex-col gap-5 py-1">
      <section className="ds-animate-in overflow-hidden rounded-lg border border-border bg-card shadow-float">
        <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.7fr)]">
          <div className="p-5 sm:p-7">
            <p className="font-mono text-micro uppercase tracking-caps-wide text-muted-foreground">
              Control center
            </p>
            <h1 className="mt-3 max-w-2xl text-[1.8rem] font-semibold tracking-display text-foreground sm:text-[2.25rem]">
              Decide donde trabaja cada agente.
            </h1>
            <p className="mt-3 max-w-2xl text-body leading-7 text-muted-foreground">
              Activa o pausa analisis y transcripcion por cuenta. El contenido y sus metricas
              se siguen sincronizando aunque ambos agentes esten apagados.
            </p>
          </div>

          <div className="grid grid-cols-2 border-t border-line bg-surface-elevated lg:border-l lg:border-t-0">
            <div className="flex flex-col justify-end border-r border-line p-5">
              <p className="font-mono text-micro uppercase tracking-caps text-muted-foreground">Cuentas</p>
              <p className="mt-3 text-[2rem] font-semibold tracking-display text-foreground">
                {connections.length}
              </p>
            </div>
            <div className="flex flex-col justify-end p-5">
              <p className="font-mono text-micro uppercase tracking-caps text-muted-foreground">Activos</p>
              <p className="mt-3 text-[2rem] font-semibold tracking-display text-success">
                {enabledAutomations}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="ds-animate-in ds-delay-1 overflow-hidden rounded-lg border border-border bg-card shadow-float">
        <div className="flex flex-col justify-between gap-5 border-b border-line p-5 sm:flex-row sm:items-start sm:p-6">
          <div className="flex gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center border border-success/30 bg-success/10 text-success">
              <Cable className="size-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-label uppercase tracking-caps text-muted-foreground">MCP remoto</p>
                <span className={`border px-2 py-1 font-mono text-micro uppercase tracking-caps ${mcp.configured ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning"}`}>
                  {mcp.configured ? "Configurado" : "Pendiente"}
                </span>
              </div>
              <h2 className="mt-2 text-title font-medium tracking-snug text-foreground">Datos reales para agentes externos.</h2>
              <p className="mt-1 max-w-2xl text-body-sm leading-6 text-muted-foreground">Cada cuenta conectada abajo queda disponible para clientes OAuth autorizados mediante briefs, metricas, analisis y transcripciones.</p>
            </div>
          </div>
          {mcp.serverUrl ? (
            <div className="min-w-0 rounded-md border border-line bg-surface-elevated px-3 py-2 sm:max-w-[320px]">
              <p className="font-mono text-micro uppercase tracking-caps text-muted-foreground">Endpoint</p>
              <code className="mt-1 block truncate font-mono text-caption text-muted-foreground">{mcp.serverUrl}</code>
            </div>
          ) : null}
        </div>

        <div className="grid gap-px bg-line lg:grid-cols-[minmax(0,1.15fr)_minmax(290px,0.85fr)]">
          <div className="bg-card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-foreground"><Link2 className="size-4 text-muted-foreground" aria-hidden="true" /><p className="text-body font-medium">Cuentas expuestas al MCP</p></div>
              <span className="font-mono text-caption text-muted-foreground">{connections.length}</span>
            </div>
            {connections.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {connections.map((connection) => (
                  <span key={connection.id} className="inline-flex items-center gap-2 rounded-md border border-line bg-surface-elevated px-2.5 py-2 text-caption text-foreground">
                    <PlatformIcon platform={connection.platform} className="text-muted-foreground" />
                    <span className="max-w-40 truncate">{getConnectionLabel(connection)}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-body-sm leading-6 text-muted-foreground">Conecta una cuenta social para habilitarla como fuente del MCP.</p>
            )}
          </div>

          <div className="bg-surface-elevated p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-foreground"><Users className="size-4 text-muted-foreground" aria-hidden="true" /><p className="text-body font-medium">Clientes conectados</p></div>
              <span className="font-mono text-caption text-muted-foreground">{mcp.clients.length}</span>
            </div>
            {mcp.activityAvailable && mcp.clients.length ? (
              <div className="mt-4 divide-y divide-line border-y border-line">
                {mcp.clients.slice(0, 3).map((client) => (
                  <div key={client.clientId} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0"><p className="truncate font-mono text-caption text-foreground">{client.clientId}</p><p className="mt-1 text-label text-muted-foreground">{client.calls} llamadas · {formatLastSeen(client.lastSeenAt)}</p></div>
                    <CircleDot className="size-3 shrink-0 text-success" aria-label="Activo" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-body-sm leading-6 text-muted-foreground">{mcp.activityAvailable ? "Todavia no hay clientes OAuth usando el MCP." : "La actividad aparecera cuando se aplique la migracion de auditoria."}</p>
            )}
          </div>
        </div>
      </section>

      <section className="ds-animate-in ds-delay-1 grid gap-px overflow-hidden rounded-lg border border-line bg-line shadow-float md:grid-cols-2">
        <div className="bg-card p-5">
          <BrainCircuit className="text-success" aria-hidden="true" />
          <p className="mt-5 text-lead font-medium text-foreground">Analisis de contenido</p>
          <p className="mt-2 text-body-sm leading-6 text-muted-foreground">
            Interpreta hooks, fortalezas, mejoras y potencial usando la evidencia disponible.
          </p>
        </div>
        <div className="bg-card p-5">
          <AudioLines className="text-muted-foreground" aria-hidden="true" />
          <p className="mt-5 text-lead font-medium text-foreground">Transcripcion</p>
          <p className="mt-2 text-body-sm leading-6 text-muted-foreground">
            Convierte videos elegibles en texto antes del analisis para mejorar la evidencia.
          </p>
        </div>
      </section>

      {connections.length === 0 ? (
        <section className="ds-animate-in ds-delay-2 rounded-lg border border-dashed border-line bg-card px-6 py-14 text-center">
          <ShieldCheck className="mx-auto text-muted-foreground" aria-hidden="true" />
          <p className="mt-4 text-lead font-medium text-foreground">No hay cuentas activas</p>
          <p className="mt-2 text-body-sm text-muted-foreground">
            Conecta una cuenta desde Settings para configurar sus agentes.
          </p>
        </section>
      ) : (
        <section className="ds-animate-in ds-delay-2 flex flex-col gap-6">
          {(["instagram", "tiktok", "youtube"] as Platform[]).map((platform) => {
            const platformConnections = connections.filter(
              (connection) => connection.platform === platform,
            );
            if (platformConnections.length === 0) return null;

            return (
              <div key={platform}>
                <div className="mb-3 flex items-center gap-2">
                  <PlatformIcon platform={platform} className="text-muted-foreground" />
                  <h2 className="font-mono text-label uppercase tracking-caps text-muted-foreground">
                    {getPlatformLabel(platform)}
                  </h2>
                </div>
                <div className="flex flex-col gap-3">
                  {platformConnections.map((connection) => (
                    <article key={connection.id} className="rounded-lg border border-border bg-card shadow-float p-4 sm:p-5">
                      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-lead font-medium text-foreground">
                            {getConnectionLabel(connection)}
                          </p>
                          <p className="mt-1 text-caption text-muted-foreground">
                            {connection.accountUsername
                              ? `@${connection.accountUsername}`
                              : connection.accountExternalId}
                          </p>
                        </div>
                        <span className="rounded-full border border-success/30 bg-success/10 px-2.5 py-1 font-mono text-micro uppercase tracking-caps text-success">
                          Conectada
                        </span>
                      </div>
                      <AgentSettingsForm
                        connectionId={connection.id}
                        initialAnalysisEnabled={connection.autoAnalysisEnabled !== false}
                        initialTranscriptionEnabled={connection.autoTranscriptionEnabled !== false}
                      />
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
