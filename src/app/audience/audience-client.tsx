"use client";

import { SegmentedSelector } from "@/components/segmented-selector";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCompactNumber, formatPercent } from "@/lib/format";
import type { AudienceOverview, PlatformFilter } from "@/lib/types";

// Gender keeps distinct hues because the categories are not ordered.
const GENDER_COLORS: Record<string, string> = {
  M: "var(--series-profile)",
  F: "var(--series-shares)",
  U: "var(--series-saves)",
};

// Neutral ramp from the Rhea preset for ranked lists (countries, cities…),
// where position already carries the meaning.
const DEFAULT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function buildHref(platform: string, connectionId?: string | null) {
  const params = new URLSearchParams();
  if (platform !== "all") params.set("platform", platform);
  if (connectionId) params.set("connection", connectionId);
  const q = params.toString();
  return q ? `/audience?${q}` : "/audience";
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card p-4">
      <p className="font-mono text-micro uppercase tracking-caps-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {sub && <p className="mt-1 text-caption text-muted-foreground">{sub}</p>}
    </div>
  );
}

function BarList({
  title,
  items,
  color = "var(--chart-1)",
}: {
  title: string;
  items: AudienceOverview["countries"];
  color?: string;
}) {
  const top = items[0]?.share ?? 0;
  return (
    <div className="bg-card p-4">
      <p className="mb-4 font-mono text-micro uppercase tracking-caps-wide text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">Sin datos.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={item.label + i}>
              <div className="mb-1 flex items-center justify-between text-body-sm">
                <span className="truncate text-foreground">{item.label}</span>
                <span className="ml-3 shrink-0 tabular-nums text-muted-foreground">
                  {formatCompactNumber(item.value)}{" "}
                  <span className="text-label">{formatPercent(item.share)}</span>
                </span>
              </div>
              <div className="h-[3px] overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: top > 0 ? `${(item.share / top) * 100}%` : "0%",
                    background: i === 0 ? color : "var(--chart-4)",
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

function GenderDonut({ genders }: { genders: AudienceOverview["genders"] }) {
  const data = genders.map((g) => ({
    name: g.label === "M" ? "Masculino" : g.label === "F" ? "Femenino" : g.label,
    value: g.value,
    share: g.share,
    color: GENDER_COLORS[g.label] ?? DEFAULT_COLORS[0],
  }));

  return (
    <div className="bg-card p-4">
      <p className="mb-4 font-mono text-micro uppercase tracking-caps-wide text-muted-foreground">Género</p>
      {data.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">Sin datos.</p>
      ) : (
        <div className="flex items-center gap-6">
          <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={36} outerRadius={55} paddingAngle={2} dataKey="value" strokeWidth={0}>
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  allowEscapeViewBox={{ x: true, y: true }}
                  offset={16}
                  wrapperStyle={{ zIndex: 20, pointerEvents: "none" }}
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="border border-border bg-card px-2.5 py-1.5 text-xs">
                        <span className="text-foreground">{payload[0].name}: </span>
                        <span className="text-muted-foreground">{formatPercent(payload[0].payload.share)}</span>
                      </div>
                    ) : null
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-2">
            {data.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-body-sm">
                <div className="size-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                <span className="text-muted-foreground">{item.name}</span>
                <span className="ml-auto pl-4 tabular-nums text-foreground">{formatPercent(item.share)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AgeChart({ ages }: { ages: AudienceOverview["ages"] }) {
  const top = ages[0]?.share ?? 0;
  return (
    <div className="bg-card p-4">
      <p className="mb-4 font-mono text-micro uppercase tracking-caps-wide text-muted-foreground">Edad</p>
      {ages.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">Sin datos.</p>
      ) : (
        <div className="space-y-2.5">
          {ages.map((item, i) => (
            <div key={item.label} className="flex items-center gap-3 text-body-sm">
              <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">{item.label}</span>
              <div className="relative flex-1">
                <div className="h-5 overflow-hidden rounded-sm bg-border">
                  <div
                    className="h-full rounded-sm transition-all duration-700"
                    style={{
                      width: top > 0 ? `${(item.share / top) * 100}%` : "0%",
                      background: i === 0 ? "var(--chart-1)" : "var(--chart-4)",
                    }}
                  />
                </div>
              </div>
              <span className="w-10 shrink-0 tabular-nums text-muted-foreground">{formatPercent(item.share)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type Props = {
  audience: AudienceOverview | null;
  audienceError: string | null;
  selectedPlatform: PlatformFilter;
  selectedConnectionId: string | null;
  platformOptions: { label: string; value: PlatformFilter }[];
  accountOptions: { label: string; value: string }[];
};

export function AudienceClient({
  audience,
  audienceError,
  selectedPlatform,
  selectedConnectionId,
  platformOptions,
  accountOptions,
}: Props) {
  return (
    <div className="flex w-full flex-col gap-0">
      {/* ── Filter bar ── */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SegmentedSelector
          options={platformOptions}
          active={selectedPlatform === "all" ? "instagram" : selectedPlatform}
          buildHref={(v) => buildHref(v, null)}
        />
        {accountOptions.length > 0 && (
          <SegmentedSelector
            options={[{ label: "Todas", value: "all" }, ...accountOptions]}
            active={selectedConnectionId ?? "all"}
            buildHref={(v) => buildHref(selectedPlatform, v === "all" ? null : v)}
          />
        )}
      </div>

      {/* ── No data state ── */}
      {!audience ? (
        <div className="flex h-64 items-center justify-center border border-dashed border-border">
          <div className="text-center">
            {audienceError ? (
              <>
                <p className="text-body text-muted-foreground">No se pudieron cargar los datos demográficos.</p>
                <p className="mt-2 font-mono text-caption text-muted-foreground/50">{audienceError}</p>
              </>
            ) : (
              <p className="text-body text-muted-foreground">
                {selectedPlatform === "instagram" || selectedPlatform === "all"
                  ? "No hay datos demográficos disponibles para esta plataforma."
                  : `Los datos demográficos de ${selectedPlatform === "youtube" ? "YouTube" : "TikTok"} no están disponibles aún.`}
              </p>
            )}
          </div>
        </div>
      ) : (
        // Stitched slab: the panels share edges, so only the outer
        // silhouette is rounded.
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-float">
          {/* ── Stat cards ── */}
          <div className="grid grid-cols-3">
            <StatCard
              label="Seguidores totales"
              value={formatCompactNumber(audience.totalFollowers)}
            />
            <div className="border-l border-border">
              <StatCard
                label="País principal"
                value={audience.countries[0]?.label ?? "—"}
                sub={audience.countries[0] ? formatPercent(audience.countries[0].share) + " del público" : undefined}
              />
            </div>
            <div className="border-l border-border">
              <StatCard
                label="Género principal"
                value={
                  audience.genders[0]?.label === "M"
                    ? "Masculino"
                    : audience.genders[0]?.label === "F"
                      ? "Femenino"
                      : audience.genders[0]?.label ?? "—"
                }
                sub={audience.genders[0] ? formatPercent(audience.genders[0].share) + " del público" : undefined}
              />
            </div>
          </div>

          {/* ── Charts grid ── */}
          <div className="grid grid-cols-1 gap-0 border-t border-border md:grid-cols-2">
            {/* Países */}
            <div className="border-r border-border">
              <BarList title="Países" items={audience.countries} color="var(--chart-1)" />
            </div>
            {/* Ciudades */}
            <BarList title="Ciudades" items={audience.cities} color="var(--chart-2)" />
          </div>

          <div className="grid grid-cols-1 gap-0 border-t border-border md:grid-cols-3">
            {/* Género */}
            <div className="border-r border-border">
              <GenderDonut genders={audience.genders} />
            </div>
            {/* Edad */}
            <div className="border-r border-border md:col-span-2">
              <AgeChart ages={audience.ages} />
            </div>
          </div>

          {audience.provinces.length > 0 && (
            <div className="border-t border-border">
              <BarList title="Provincias / Estados" items={audience.provinces} color="var(--chart-3)" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
