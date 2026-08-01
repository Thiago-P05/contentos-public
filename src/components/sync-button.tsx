"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import type { PlatformFilter } from "@/lib/types";
import { Button } from "@/components/ui/button";

export function SyncButton({
  enabled,
  platform = "all",
  connectionId = null,
  mode = "full",
  label,
}: {
  enabled: boolean;
  platform?: PlatformFilter;
  connectionId?: string | null;
  mode?: "dashboard" | "full";
  label?: string;
}) {
  const [status, setStatus] = useState<"idle" | "done" | "warning" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSync() {
    if (!enabled) {
      return;
    }

    setMessage(null);
    setStatus("idle");

    startTransition(async () => {
      try {
        const response = await fetch("/api/sync/run", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            platform,
            connectionId,
            mode,
          }),
        });
        const payload = (await response.json()) as {
          message?: string;
          error?: string;
          warnings?: string[];
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "No se pudo correr la sincronizacion.");
        }

        if (payload.warnings?.length) {
          setStatus("warning");
          setMessage(
            `Sync completado con advertencias: ${payload.warnings.join(" \u00b7 ")}`,
          );
        } else {
          setStatus("done");
          setMessage(payload.message ?? "Sincronizacion completada.");
        }
      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "No se pudo sincronizar.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="secondary"
        onClick={handleSync}
        disabled={!enabled || isPending}
      >
        {isPending ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
        {label ?? (mode === "full" ? "Sincronizar" : "Refresh dashboard")}
      </Button>
      {message ? (
        <p
          className={
            status === "done"
              ? "text-body-sm text-foreground"
              : status === "warning"
                ? "text-body-sm text-warning"
                : "text-body-sm text-danger"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
