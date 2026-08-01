export default function CalendarLoading() {
  return (
    <div className="space-y-6 py-1" aria-busy="true" aria-label="Cargando calendario">
      <section className="animate-pulse">
        <div className="h-3 w-28 rounded bg-surface-elevated" />
        <div className="mt-3 h-8 w-64 rounded bg-surface-elevated" />
        <div className="mt-2 h-4 w-96 max-w-full rounded bg-surface-elevated" />
      </section>

      <section className="animate-pulse">
        <div className="ds-card min-h-[480px] rounded-xl bg-surface-elevated/30 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="h-6 w-40 rounded bg-surface-elevated" />
            <div className="flex gap-2">
              <div className="h-8 w-8 rounded bg-surface-elevated" />
              <div className="h-8 w-8 rounded bg-surface-elevated" />
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, index) => (
              <div
                key={index}
                className="aspect-square rounded bg-surface-elevated/60"
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
