import { fetchInstagramAudienceOverview } from "@/lib/instagram-live";
import { normalizePlatformFilter, PLATFORM_OPTIONS } from "@/lib/platforms";
import { resolvePreferredConnectionId } from "@/lib/preferred-connection";
import { requireAllowedPageUser } from "@/lib/server-auth";
import { listPlatformConnections } from "@/lib/supabase/repository";
import { AudienceClient } from "./audience-client";
import type { PlatformFilter } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    platform?: string;
    connection?: string;
  }>;
};

export default async function AudiencePage({ searchParams }: PageProps) {
  await requireAllowedPageUser();

  const params = await searchParams;
  const selectedPlatform = normalizePlatformFilter(params.platform);
  const connections = await listPlatformConnections({ includeDisconnected: false });

  const igConnections = connections.filter((c) => c.platform === "instagram");
  const availableConnections =
    selectedPlatform === "instagram" || selectedPlatform === "all" ? igConnections : [];

  const selectedConnectionId = resolvePreferredConnectionId(
    availableConnections,
    params.connection ?? null,
  );

  let audience = null;
  let audienceError: string | null = null;

  if (selectedPlatform === "instagram" || selectedPlatform === "all") {
    try {
      audience = await fetchInstagramAudienceOverview(selectedConnectionId);
    } catch (error) {
      audienceError = error instanceof Error ? error.message : "Error al cargar datos de audiencia.";
      console.error("No se pudo cargar la audiencia de Instagram.", error);
    }
  }

  const platformOptions = PLATFORM_OPTIONS.filter((o) => o.value !== "all").map((o) => ({
    label: o.label,
    value: o.value as PlatformFilter,
  }));

  const accountOptions =
    igConnections.length > 1
      ? igConnections.map((c) => ({
          label: c.accountUsername ?? c.displayName ?? c.accountExternalId,
          value: c.id,
        }))
      : [];

  return (
    <AudienceClient
      audience={audience}
      audienceError={audienceError}
      selectedPlatform={selectedPlatform}
      selectedConnectionId={selectedConnectionId}
      platformOptions={platformOptions}
      accountOptions={accountOptions}
    />
  );
}
