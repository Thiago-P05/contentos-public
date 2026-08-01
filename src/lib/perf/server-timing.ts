/**
 * Lightweight server-side timing for data phases.
 * Emits structured console.info logs in development / when PERF_LOG=1.
 * Can also format Server-Timing header values. Never throws; never logs secrets.
 */

export type PerfMeta = Record<string, string | number | boolean | null | undefined>;

export type ServerTimingSpan = {
  name: string;
  durationMs: number;
  meta?: PerfMeta;
};

export type ServerTimer = {
  /** Start a named span (no-op if already open). */
  start(name: string): void;
  /** End a named span; returns duration ms (0 if span was never started). */
  end(name: string, meta?: PerfMeta): number;
  /** Time an async function as a named span. */
  timeAsync<T>(name: string, fn: () => Promise<T>, meta?: PerfMeta | ((result: T) => PerfMeta)): Promise<T>;
  /** Time a sync function as a named span. */
  timeSync<T>(name: string, fn: () => T, meta?: PerfMeta | ((result: T) => PerfMeta)): T;
  /** End the implicit `total` span from timer creation and optionally log. */
  finish(meta?: PerfMeta): number;
  /** Server-Timing header value (e.g. `auth;dur=12.3, catalog;dur=45`). */
  toHeaderValue(): string;
  /** Emit structured log when perf logging is enabled. Safe no-op otherwise. */
  log(meta?: PerfMeta): void;
  getSpans(): ReadonlyArray<ServerTimingSpan>;
};

const SENSITIVE_KEY =
  /api[_-]?key|authorization|bearer|cookie|password|secret|token|service[_-]?role/i;

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

/** True when structured perf logs should be emitted. */
export function shouldLogPerf(): boolean {
  try {
    return process.env.PERF_LOG === "1" || process.env.NODE_ENV === "development";
  } catch {
    return false;
  }
}

function sanitizeMeta(meta: PerfMeta | undefined): PerfMeta | undefined {
  if (!meta) {
    return undefined;
  }

  const next: PerfMeta = {};
  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_KEY.test(key)) {
      continue;
    }
    if (value === undefined) {
      continue;
    }
    if (typeof value === "string" && value.length > 200) {
      next[key] = `${value.slice(0, 200)}…`;
      continue;
    }
    next[key] = value;
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

function roundMs(ms: number): number {
  return Math.round(ms * 10) / 10;
}

/**
 * Create a timer that tracks named spans for one request / data load.
 * An implicit `total` span starts at creation; call `finish()` when done.
 */
export function createServerTimer(label: string): ServerTimer {
  const createdAt = nowMs();
  const open = new Map<string, number>();
  const spans: ServerTimingSpan[] = [];
  let finished = false;

  const recordSpan = (name: string, durationMs: number, meta?: PerfMeta) => {
    const existing = spans.findIndex((span) => span.name === name);
    const entry: ServerTimingSpan = {
      name,
      durationMs: roundMs(durationMs),
      meta: sanitizeMeta(meta),
    };
    if (existing >= 0) {
      spans[existing] = entry;
    } else {
      spans.push(entry);
    }
  };

  const start = (name: string) => {
    try {
      if (!open.has(name)) {
        open.set(name, nowMs());
      }
    } catch {
      // never throw
    }
  };

  const end = (name: string, meta?: PerfMeta): number => {
    try {
      const started = open.get(name);
      open.delete(name);
      if (started === undefined) {
        return 0;
      }
      const durationMs = nowMs() - started;
      recordSpan(name, durationMs, meta);
      return roundMs(durationMs);
    } catch {
      return 0;
    }
  };

  const resolveMeta = <T>(
    meta: PerfMeta | ((result: T) => PerfMeta) | undefined,
    result: T,
  ): PerfMeta | undefined => {
    if (typeof meta === "function") {
      try {
        return meta(result);
      } catch {
        return undefined;
      }
    }
    return meta;
  };

  const timeAsync = async <T>(
    name: string,
    fn: () => Promise<T>,
    meta?: PerfMeta | ((result: T) => PerfMeta),
  ): Promise<T> => {
    start(name);
    try {
      const result = await fn();
      end(name, resolveMeta(meta, result));
      return result;
    } catch (error) {
      end(name, { error: true });
      throw error;
    }
  };

  const timeSync = <T>(
    name: string,
    fn: () => T,
    meta?: PerfMeta | ((result: T) => PerfMeta),
  ): T => {
    start(name);
    try {
      const result = fn();
      end(name, resolveMeta(meta, result));
      return result;
    } catch (error) {
      end(name, { error: true });
      throw error;
    }
  };

  const toHeaderValue = (): string => {
    try {
      return spans
        .map((span) => {
          const dur = span.durationMs.toFixed(1);
          return `${span.name};dur=${dur}`;
        })
        .join(", ");
    } catch {
      return "";
    }
  };

  const log = (meta?: PerfMeta) => {
    try {
      if (!shouldLogPerf()) {
        return;
      }

      const spanSummary = Object.fromEntries(
        spans.map((span) => [span.name, span.durationMs]),
      );
      const spanMeta = Object.fromEntries(
        spans
          .filter((span) => span.meta && Object.keys(span.meta).length > 0)
          .map((span) => [span.name, span.meta]),
      );

      const payload = {
        label,
        ms: spanSummary,
        ...(Object.keys(spanMeta).length > 0 ? { spans: spanMeta } : {}),
        ...(sanitizeMeta(meta) ?? {}),
        serverTiming: toHeaderValue(),
      };

      console.info(`[perf] ${label}`, payload);
    } catch {
      // never throw from logging
    }
  };

  const finish = (meta?: PerfMeta): number => {
    try {
      if (!finished) {
        finished = true;
        for (const name of [...open.keys()]) {
          end(name);
        }
        const totalMs = nowMs() - createdAt;
        recordSpan("total", totalMs);
      }
      log(meta);
      const total = spans.find((span) => span.name === "total");
      return total?.durationMs ?? 0;
    } catch {
      return 0;
    }
  };

  return {
    start,
    end,
    timeAsync,
    timeSync,
    finish,
    toHeaderValue,
    log,
    getSpans: () => spans,
  };
}
