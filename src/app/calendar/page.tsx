import { MonthView } from "@/components/calendar/month-view";
import { requireAllowedPageUser } from "@/lib/server-auth";
import { getActivePlatformConnections, listContentCatalog } from "@/lib/supabase/repository";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  await requireAllowedPageUser();

  // Slim load: last 12 months covers typical month navigation without the full catalog.
  // MonthView filters client-side; older months may be empty if the user navigates far back.
  const publishedAfter = new Date();
  publishedAfter.setUTCMonth(publishedAfter.getUTCMonth() - 12);
  publishedAfter.setUTCDate(1);
  publishedAfter.setUTCHours(0, 0, 0, 0);

  const connections = await getActivePlatformConnections();
  const catalog = await listContentCatalog({
    publishedAfter: publishedAfter.toISOString(),
  });

  return (
    <main className="flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="ds-label">Calendario</p>
          <h1 className="mt-2 text-[1.75rem] font-semibold tracking-display text-foreground">Content Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organiza, agenda y programa tu contenido en un entorno centralizado.
          </p>
        </div>
      </div>

      <div className="ds-card overflow-hidden rounded-xl">
        <MonthView connections={connections} items={catalog} />
      </div>
    </main>
  );
}
