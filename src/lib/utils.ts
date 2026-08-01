import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

export function serializeVector(values: number[]) {
  return `[${values.join(",")}]`;
}

export function parseDurationToSeconds(duration: string) {
  const match =
    /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/u.exec(duration);

  if (!match) {
    return null;
  }

  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;

  return (
    Number(days) * 86400 +
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(seconds)
  );
}

export function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function parseSrtToText(input: string) {
  return input
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => {
      if (!line.trim()) return false;
      if (/^\d+$/u.test(line.trim())) return false;
      if (/^\d{2}:\d{2}:\d{2},\d{3}\s-->\s\d{2}:\d{2}:\d{2},\d{3}$/u.test(line)) {
        return false;
      }
      return true;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function metricValue(metrics: Record<string, number | null>, ...keys: string[]) {
  for (const key of keys) {
    const value = metrics[key];

    if (typeof value === "number") {
      return value;
    }
  }

  return null;
}
