"use client";

import { BrainCircuit, LoaderCircle, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AnalysisStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";

export function AnalyzeContentButton({
  contentId,
  status,
  compact = false,
  canRetryProcessing = false,
}: {
  contentId: string;
  status: AnalysisStatus;
  compact?: boolean;
  canRetryProcessing?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (
    (status === "processing" && !canRetryProcessing) ||
    status === "ready" ||
    status === "fallback"
  ) {
    return null;
  }

  function analyze() {
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/content/${contentId}/analyze`, { method: "POST" });
        const payload = (await response.json()) as {
          error?: string;
          analysis?: { outcome?: string };
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "No se pudo analizar el contenido.");
        }

        setMessage(
          payload.analysis?.outcome === "failed"
            ? "El analisis volvio a fallar."
            : "Analisis completado.",
        );
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "No se pudo analizar.");
        router.refresh();
      }
    });
  }

  const RetryIcon = status === "failed" ? RotateCcw : BrainCircuit;

  return (
    <div className={compact ? "flex flex-col gap-1.5" : "flex flex-wrap items-center gap-3"}>
      <Button
        type="button"
        variant="secondary"
        size={compact ? "sm" : "default"}
        disabled={isPending}
        onClick={analyze}
        className={compact ? "w-full" : undefined}
      >
        {isPending ? (
          <LoaderCircle data-icon="inline-start" className="animate-spin" />
        ) : (
          <RetryIcon data-icon="inline-start" />
        )}
        {isPending
          ? "Analizando..."
          : status === "failed" || status === "processing"
            ? "Reintentar"
            : "Analizar"}
      </Button>
      {message ? (
        <p className={compact ? "text-label leading-4 text-muted-foreground" : "text-caption text-muted-foreground"}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
