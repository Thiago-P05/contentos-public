const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com"]);
const BLOCKED_PATH_PREFIXES = new Set([
  "accounts",
  "developer",
  "explore",
  "p",
  "reel",
  "reels",
  "stories",
  "tv",
]);

export class InvalidCompetitionProfileUrlError extends Error {}

function coerceUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new InvalidCompetitionProfileUrlError("Pegá una URL de perfil de Instagram.");
  }

  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(normalized);
  } catch {
    throw new InvalidCompetitionProfileUrlError("La URL no es válida.");
  }
}

export function normalizeInstagramProfileUrl(value: string) {
  const url = coerceUrl(value);
  const host = url.hostname.toLowerCase();

  if (!INSTAGRAM_HOSTS.has(host)) {
    throw new InvalidCompetitionProfileUrlError(
      "Solo se aceptan URLs de perfiles públicos de Instagram.",
    );
  }

  const pathSegments = url.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (pathSegments.length !== 1) {
    throw new InvalidCompetitionProfileUrlError(
      "Pegá la URL del perfil, no la de un post, reel o sección interna.",
    );
  }

  const username = pathSegments[0]!.replace(/^@+/, "").trim();

  if (!username || BLOCKED_PATH_PREFIXES.has(username.toLowerCase())) {
    throw new InvalidCompetitionProfileUrlError(
      "Pegá la URL del perfil, no la de un post, reel o sección interna.",
    );
  }

  if (!/^[a-zA-Z0-9._]+$/.test(username)) {
    throw new InvalidCompetitionProfileUrlError("El username del perfil no es válido.");
  }

  return {
    username,
    normalizedUrl: `https://www.instagram.com/${username}/`,
  };
}
