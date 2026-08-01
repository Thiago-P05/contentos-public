export const dynamic = "force-dynamic";

export default function PatternsPage() {
  return (
    <div className="space-y-5 py-1">
      <section className="ds-animate-in">
        <p className="font-mono text-micro uppercase tracking-caps-wide text-muted-foreground">
          Hooks e ideas
        </p>
        <h1 className="mt-2 flex items-baseline gap-2 text-[1.75rem] font-semibold leading-tight tracking-display text-foreground">
          Patrones que{" "}
          <em className="text-[2.1rem] font-semibold not-italic tracking-snug">
            funcionan
          </em>
        </h1>
      </section>

      <section className="ds-animate-in ds-delay-1 glass-panel rounded-xl p-10 sm:p-14">
        <div className="max-w-lg">
          <p className="font-mono text-micro uppercase tracking-caps-wide text-muted-foreground">
            Próximamente
          </p>
          <p className="mt-5 text-[2.8rem] font-semibold leading-tight tracking-display text-foreground">
            En construcción
          </p>
          <div className="mt-6 h-[1px] w-12 bg-[var(--line-accent)]" />
          <p className="mt-6 text-body leading-7 text-muted-foreground max-w-[400px]">
            Extracción automática de hooks que generaron picos de retención, ideas de contenido basadas en tus mejores piezas, y patrones narrativos detectados por Gemini.
          </p>

          {/* Feature preview */}
          <div className="mt-8 flex flex-wrap gap-2">
            {["Hooks virales", "Patrones narrativos", "Ideas generadas por IA", "Top aperturas", "Formatos recurrentes"].map((feat) => (
              <span
                key={feat}
                className="rounded-full border border-line px-3 py-1.5 font-mono text-label uppercase tracking-caps text-muted-foreground"
              >
                {feat}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
