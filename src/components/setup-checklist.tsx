import { Badge } from "@/components/ui/badge";

export function SetupChecklist({
  missingEnv,
  setupIssues = [],
}: {
  missingEnv: string[];
  setupIssues?: string[];
}) {
  return (
    <section className="ds-card ds-animate-in ds-delay-1 rounded-md px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
        <div className="shrink-0">
          <p className="ds-label">
            Setup pendiente
          </p>
          <p className="mt-1.5 text-body text-muted-foreground">
            Completa `.env.local`, corre las migraciones de Supabase y conecta cuentas desde Account.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {missingEnv.map((key) => (
            <Badge key={key} variant="success" className="font-mono">
              {key}
            </Badge>
          ))}
          {setupIssues.map((issue) => (
            <span
              key={issue}
              className="inline-flex min-h-6 items-center rounded-full bg-surface-elevated px-3 text-caption text-muted-foreground shadow-[var(--shadow-ring-light)]"
            >
              {issue}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
