export default function ContentLoading() {
  return (
    <div className="space-y-3 py-1" aria-busy="true" aria-label="Cargando biblioteca">
      <section className="animate-pulse">
        <div className="h-3 w-56 rounded bg-surface-elevated" />
        <div className="mt-2.5 flex flex-wrap gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-4 w-16 rounded bg-surface-elevated" />
          ))}
        </div>
      </section>

      <section className="animate-pulse">
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <article
              key={index}
              className="ds-card overflow-hidden rounded-lg"
            >
              <div className="aspect-[4/5] bg-surface-elevated" />
              <div className="space-y-2 p-3">
                <div className="h-3 w-3/4 rounded bg-surface-elevated" />
                <div className="h-3 w-1/2 rounded bg-surface-elevated" />
                <div className="mt-2 flex gap-2">
                  <div className="h-3 w-10 rounded bg-surface-elevated" />
                  <div className="h-3 w-10 rounded bg-surface-elevated" />
                  <div className="h-3 w-10 rounded bg-surface-elevated" />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
