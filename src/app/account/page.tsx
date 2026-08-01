import { ConnectionBriefForm } from "@/components/connection-brief-form";
﻿import { StatusBadge } from "@/components/status-badge";
import {
  isOAuthConfiguredForPlatform,
} from "@/lib/oauth";
import { getPlatformOAuthMissingKeys } from "@/lib/env";
import { formatDateTime, formatRelative } from "@/lib/format";
import { getPlatformLabel } from "@/lib/platforms";
import { requireAllowedPageUser } from "@/lib/server-auth";
import { getRecentSyncRuns, listPlatformConnections } from "@/lib/supabase/repository";
import type { Platform, PlatformConnection, SyncRun } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    connected?: string;
    disconnected?: string;
    briefSaved?: string;
    error?: string;
  }>;
};

const accountMessages: Record<string, string> = {
  brief: "No se pudo guardar el brief de la cuenta.",
  disconnect: "No se pudo desconectar la cuenta.",
  oauth: "No se pudo completar la conexion OAuth.",
};

function getConnectionLabel(connection: PlatformConnection) {
  return connection.accountUsername ?? connection.displayName ?? connection.accountExternalId;
}

function getLastSyncMap(syncRuns: SyncRun[]) {
  const map = new Map<string, SyncRun>();

  for (const run of syncRuns) {
    if (!run.connectionId) {
      continue;
    }

    if (!map.has(run.connectionId)) {
      map.set(run.connectionId, run);
    }
  }

  return map;
}

function PlatformCard({
  platform,
  connections,
  syncRunsMap,
}: {
  platform: Platform;
  connections: PlatformConnection[];
  syncRunsMap: Map<string, SyncRun>;
}) {
  const oauthReady = isOAuthConfiguredForPlatform(platform);
  const allowsMultipleConnections = true;
  const activeConnections = connections.filter((connection) => connection.status === "active");
  const missingKeys = getPlatformOAuthMissingKeys(platform);

  return (
    <article className="glass-panel rounded-lg p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-micro uppercase tracking-caps-wide text-muted-foreground">
            {getPlatformLabel(platform)}
          </p>
          <p className="mt-2 text-[1.2rem] font-semibold tracking-display text-foreground">
            {allowsMultipleConnections ? "Multi-cuenta habilitada" : "Una conexion activa en v1"}
          </p>
          <p className="mt-2 max-w-xl text-body leading-7 text-muted-foreground">
            {allowsMultipleConnections
              ? `Conecta todas las cuentas de ${getPlatformLabel(platform)} que quieras usar en el dashboard.`
              : "Esta plataforma usa una sola conexion activa por ahora; una reconexion reemplaza la anterior."}
          </p>

          {!oauthReady ? (
            <p className="mt-2 max-w-2xl text-body-sm leading-6 text-warning">
              Falta configurar OAuth para {getPlatformLabel(platform)}. Carga en .env.local:{" "}
              {missingKeys.join(", ")}.
            </p>
          ) : null}
        </div>

        {oauthReady ? (
          <a
            href={`/api/oauth/${platform}/start`}
            className="shrink-0 rounded-sm border border-line px-4 py-2 text-body font-medium text-muted-foreground transition hover:border-line-strong hover:text-foreground"
          >
            {allowsMultipleConnections
              ? "Conectar otra cuenta"
              : activeConnections.length > 0
                ? "Reconectar"
                : "Conectar"}
          </a>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="shrink-0 cursor-not-allowed rounded-sm border border-warning/20 bg-warning/[0.05] px-4 py-2 text-body-sm text-warning opacity-90"
            title={`Falta configurar: ${missingKeys.join(", ")}`}
          >
            Configurar OAuth
          </button>
        )}
      </div>

      {connections.length === 0 ? (
        <div className="mt-5 rounded-md border border-dashed border-line px-5 py-10 text-center text-body text-muted-foreground">
          No hay cuentas conectadas todavia.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {connections.map((connection) => {
            const latestRun = syncRunsMap.get(connection.id);

            return (
              <div
                key={connection.id}
                className="rounded-md border border-line bg-surface-elevated p-4"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lead font-medium text-foreground">
                        {getConnectionLabel(connection)}
                      </p>
                      <StatusBadge status={connection.status} />
                    </div>
                    <p className="mt-1 text-body-sm text-muted-foreground">
                      {connection.accountUsername
                        ? `@${connection.accountUsername}`
                        : connection.accountExternalId}
                    </p>
                  </div>

                  <form
                    action={`/api/account/connections/${connection.id}/disconnect`}
                    method="post"
                  >
                    <button
                      type="submit"
                      className="rounded-sm border border-line px-3.5 py-2 text-body-sm text-muted-foreground transition hover:border-line-strong hover:text-foreground"
                    >
                      Desconectar
                    </button>
                  </form>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="font-mono text-micro uppercase tracking-caps text-muted-foreground">
                      Estado
                    </p>
                    <p className="mt-1 text-body text-foreground">
                      {connection.status === "active" ? "Lista para sync" : "Sincronizacion detenida"}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-micro uppercase tracking-caps text-muted-foreground">
                      Ultimo sync
                    </p>
                    <p className="mt-1 text-body text-foreground">
                      {latestRun ? formatRelative(latestRun.startedAt) : "Sin ejecuciones"}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-micro uppercase tracking-caps text-muted-foreground">
                      Token
                    </p>
                    <p className="mt-1 text-body text-foreground">
                      {connection.tokenExpiresAt
                        ? `vence ${formatDateTime(connection.tokenExpiresAt)}`
                        : "sin vencimiento expuesto"}
                    </p>
                  </div>
                </div>

                <ConnectionBriefForm
                  connectionId={connection.id}
                  brief={connection.brief}
                />
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

export default async function AccountPage({ searchParams }: PageProps) {
  await requireAllowedPageUser();

  const params = await searchParams;
  const [connections, syncRuns] = await Promise.all([
    listPlatformConnections({ includeDisconnected: true }),
    getRecentSyncRuns(30),
  ]);
  const syncRunsMap = getLastSyncMap(syncRuns);

  return (
    <div className="space-y-4 py-1">
      <section className="ds-animate-in flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-micro uppercase tracking-caps-wide text-muted-foreground">Account</p>
          <h1 className="mt-2 text-[1.6rem] font-semibold tracking-display text-foreground">
            Conexiones OAuth
          </h1>
          <p className="mt-2 max-w-3xl text-body leading-7 text-muted-foreground">
            Desde aca conectas Instagram, TikTok y YouTube. Las cuentas desconectadas conservan su historial, pero no sus credenciales.
          </p>
        </div>
      </section>

      {params.connected ? (
        <section className="ds-animate-in ds-delay-1 rounded-md border border-secondary/20 bg-secondary/[0.06] px-5 py-4 text-body text-muted-foreground">
          Conexion {params.connected} guardada correctamente.
        </section>
      ) : null}

      {params.disconnected ? (
        <section className="ds-animate-in ds-delay-1 rounded-md border border-warning/20 bg-warning/[0.06] px-5 py-4 text-body text-warning">
          La cuenta se desconecto correctamente.
        </section>
      ) : null}

      {params.briefSaved ? (
        <section className="ds-animate-in ds-delay-1 rounded-md border border-secondary/20 bg-secondary/[0.06] px-5 py-4 text-body text-muted-foreground">
          Brief de la cuenta actualizado correctamente.
        </section>
      ) : null}

      {params.error ? (
        <section className="ds-animate-in ds-delay-1 rounded-md border border-danger/20 bg-danger/[0.06] px-5 py-4 text-body text-danger">
          {accountMessages[params.error] ?? "No se pudo completar la operacion."}
        </section>
      ) : null}

      <section className="ds-animate-in ds-delay-2 space-y-4">
        {(["instagram", "tiktok", "youtube"] as Platform[]).map((platform) => (
          <PlatformCard
            key={platform}
            platform={platform}
            connections={connections.filter((connection) => connection.platform === platform)}
            syncRunsMap={syncRunsMap}
          />
        ))}
      </section>
    </div>
  );
}
