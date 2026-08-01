import { formatCompactNumber, formatPercent } from "@/lib/format";
import { getPlatformLabel } from "@/lib/platforms";
import type { AudienceOverview, PlatformFilter } from "@/lib/types";

type AudiencePanelProps = {
  audience: AudienceOverview | null;
  selectedPlatform: PlatformFilter;
  error?: string | null;
};

function BreakdownColumn({
  title,
  items,
}: {
  title: string;
  items: AudienceOverview["countries"];
}) {
  const topValue = items[0]?.share ?? 0;

  return (
    <div className="panel-elevated rounded-md p-4">
      <p className="font-mono text-micro uppercase tracking-caps-wide text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="mt-4 text-body-sm text-muted-foreground">Sin datos.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item, i) => (
            <div key={title + "-" + item.label}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-body-sm">
                <span className="truncate font-medium text-foreground">{item.label}</span>
                <span className="shrink-0 text-caption tabular-nums text-muted-foreground">
                  {formatCompactNumber(item.value)} <span className="text-muted-foreground">{formatPercent(item.share)}</span>
                </span>
              </div>
              <div className="h-[3px] overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: topValue > 0 ? String((item.share / topValue) * 100) + "%" : "0%",
                    background: i === 0 ? "var(--foreground)" : "var(--secondary)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AudiencePanel({ audience, selectedPlatform, error }: AudiencePanelProps) {
  return (
    <article className="glass-panel rounded-lg p-5 sm:p-6">
      <div>
        <p className="font-mono text-micro uppercase tracking-caps-wide text-muted-foreground">Publico</p>
        <p className="mt-2 text-[1.5rem] font-semibold tracking-display text-foreground">
          Audiencia y demografia
        </p>
        <p className="mt-2 max-w-3xl text-body leading-7 text-muted-foreground">
          Pais, ciudad, provincia, genero y edad del publico disponible por plataforma.
        </p>
      </div>

      {!audience ? (
        <div className="mt-6 rounded-md border border-dashed border-line px-6 py-14 text-center">
          <p className="font-mono text-micro uppercase tracking-caps-wide text-muted-foreground">
            {getPlatformLabel(selectedPlatform)}
          </p>
          {error ? (
            <>
              <p className="mt-4 text-lead text-muted-foreground">No se pudieron cargar los datos demograficos.</p>
              <p className="mt-2 font-mono text-caption text-muted-foreground/60">{error}</p>
            </>
          ) : (
            <p className="mt-4 text-lead text-muted-foreground">
              Todavia no hay datos demograficos disponibles para esta plataforma.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 xl:grid-cols-3">
            <div className="panel-elevated rounded-md p-4">
              <p className="font-mono text-micro uppercase tracking-caps-wide text-muted-foreground">Plataforma</p>
              <p className="mt-3 text-[1rem] font-medium text-foreground">{audience.sourceLabel}</p>
            </div>
            <div className="panel-elevated rounded-md p-4">
              <p className="font-mono text-micro uppercase tracking-caps-wide text-muted-foreground">Seguidores totales</p>
              <p className="mt-2 text-[2.5rem] font-semibold leading-none tracking-display text-foreground">
                {formatCompactNumber(audience.totalFollowers)}
              </p>
            </div>
            <div className="panel-elevated rounded-md p-4">
              <p className="font-mono text-micro uppercase tracking-caps-wide text-muted-foreground">Pais principal</p>
              <p className="mt-3 text-[1rem] font-medium text-foreground">
                {audience.countries[0]?.label ?? "Sin dato"}
              </p>
              <p className="mt-1 text-body-sm text-muted-foreground">
                {audience.countries[0] ? formatPercent(audience.countries[0].share) + " del publico" : "Sin dato"}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <BreakdownColumn title="Paises" items={audience.countries} />
            <BreakdownColumn title="Ciudades" items={audience.cities} />
            <BreakdownColumn title="Provincias" items={audience.provinces} />
            <div className="space-y-4">
              <BreakdownColumn title="Genero" items={audience.genders} />
              <BreakdownColumn title="Edad" items={audience.ages} />
            </div>
          </div>
        </>
      )}
    </article>
  );
}
