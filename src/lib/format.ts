import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export function formatCompactNumber(value: number | null) {
  if (value === null) {
    return "\u2014";
  }

  return new Intl.NumberFormat("es-AR", {
    notation: "compact",
    maximumFractionDigits: value > 999 ? 1 : 0,
  }).format(value);
}

export function formatPercent(value: number | null) {
  if (value === null) {
    return "\u2014";
  }

  return `${value.toFixed(1)}%`;
}

export function formatMilliseconds(value: number | null) {
  if (value === null) {
    return "\u2014";
  }

  if (value < 1000) {
    return `${Math.round(value)} ms`;
  }

  const totalSeconds = value / 1000;

  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(totalSeconds >= 10 ? 0 : 1)} s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);

  if (minutes < 60) {
    return `${minutes} m ${String(seconds).padStart(2, "0")} s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours} h ${String(remainingMinutes).padStart(2, "0")} m`;
}

export function formatDateTime(value: string) {
  return format(new Date(value), "dd/MM/yyyy HH:mm");
}

export function formatDateOnly(value: string) {
  return format(new Date(value), "dd/MM/yyyy");
}

export function formatRelative(value: string) {
  return formatDistanceToNow(new Date(value), {
    addSuffix: true,
    locale: es,
  });
}

export function formatSeconds(value: number | null) {
  if (value === null) {
    return "\u2014";
  }

  if (value < 60) {
    return value.toFixed(value >= 10 ? 0 : 1) + " s";
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);

  if (minutes < 60) {
    return minutes + " m " + String(seconds).padStart(2, "0") + " s";
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return hours + " h " + String(remainingMinutes).padStart(2, "0") + " m";
}
