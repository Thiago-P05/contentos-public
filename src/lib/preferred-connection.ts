import type { PlatformConnection } from "@/lib/types";

/**
 * Account to pre-select when the user has not picked one yet. Optional: leave it
 * unset and the first available connection wins.
 */
export const DEFAULT_CONNECTION_USERNAME =
  process.env.NEXT_PUBLIC_DEFAULT_CONNECTION_USERNAME ?? "";

export function resolvePreferredConnectionId(
  availableConnections: PlatformConnection[],
  requestedConnectionId?: string | null,
  preferredUsername = DEFAULT_CONNECTION_USERNAME,
) {
  if (requestedConnectionId === "all") {
    return "all";
  }

  if (
    requestedConnectionId &&
    availableConnections.some((connection) => connection.id === requestedConnectionId)
  ) {
    return requestedConnectionId;
  }

  const normalizedPreferred = preferredUsername.trim().toLowerCase();
  const preferredConnection = normalizedPreferred
    ? availableConnections.find(
        (connection) =>
          typeof connection.accountUsername === "string" &&
          connection.accountUsername.trim().toLowerCase() === normalizedPreferred,
      )
    : undefined;

  if (preferredConnection) {
    return preferredConnection.id;
  }

  return availableConnections[0]?.id ?? null;
}
