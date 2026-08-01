export default function AudienceLoading() {
  return (
    <div className="space-y-4 py-1" aria-busy="true" aria-label="Cargando audiencia">
      <section className="animate-pulse">
        <div className="h-3 w-40 rounded bg-surface-elevated" />
        <div className="mt-3 flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-7 w-20 rounded-full bg-surface-elevated" />
          ))}
        </div>
      </section>

      <section className="animate-pulse grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="ds-card h-24 rounded-md bg-surface-elevated/40 p-4"
          >
            <div className="h-3 w-20 rounded bg-surface-elevated" />
            <div className="mt-3 h-6 w-16 rounded bg-surface-elevated" />
          </div>
        ))}
      </section>

      <section className="animate-pulse grid gap-3 lg:grid-cols-2">
        <div className="ds-card h-[280px] rounded-lg bg-surface-elevated/30" />
        <div className="ds-card h-[280px] rounded-lg bg-surface-elevated/30" />
      </section>
    </div>
  );
}
