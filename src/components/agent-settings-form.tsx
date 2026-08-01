"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function AgentSettingsForm({
  connectionId,
  initialAnalysisEnabled,
  initialTranscriptionEnabled,
}: {
  connectionId: string;
  initialAnalysisEnabled: boolean;
  initialTranscriptionEnabled: boolean;
}) {
  const router = useRouter();
  const [analysisEnabled, setAnalysisEnabled] = useState(initialAnalysisEnabled);
  const [transcriptionEnabled, setTranscriptionEnabled] = useState(
    initialTranscriptionEnabled,
  );
  const [savedSettings, setSavedSettings] = useState({
    analysisEnabled: initialAnalysisEnabled,
    transcriptionEnabled: initialTranscriptionEnabled,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasChanges =
    analysisEnabled !== savedSettings.analysisEnabled ||
    transcriptionEnabled !== savedSettings.transcriptionEnabled;

  function saveSettings() {
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/agents/settings/${connectionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            autoAnalysisEnabled: analysisEnabled,
            autoTranscriptionEnabled: transcriptionEnabled,
          }),
        });
        const payload = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "No se pudo guardar la configuracion.");
        }

        setSavedSettings({ analysisEnabled, transcriptionEnabled });
        setMessage("Configuracion guardada.");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "No se pudo guardar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-2">
        <div className="flex items-start justify-between gap-4 bg-card p-4">
          <div>
            <p className="text-body font-medium text-foreground">Analisis de contenido</p>
            <p className="mt-1 text-caption leading-5 text-muted-foreground">
              Genera insights en cada full sync para esta cuenta.
            </p>
          </div>
          <Switch
            checked={analysisEnabled}
            disabled={isPending}
            aria-label="Analisis automatico"
            onCheckedChange={setAnalysisEnabled}
          />
        </div>

        <div className="flex items-start justify-between gap-4 bg-card p-4">
          <div>
            <p className="text-body font-medium text-foreground">Transcripcion</p>
            <p className="mt-1 text-caption leading-5 text-muted-foreground">
              Se ejecuta solo cuando la plataforma entrega un video descargable.
            </p>
          </div>
          <Switch
            checked={transcriptionEnabled}
            disabled={isPending}
            aria-label="Transcripcion automatica"
            onCheckedChange={setTranscriptionEnabled}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={cn("text-caption", message?.includes("guardada") ? "text-success" : "text-danger")}>
          {message}
        </p>
        <Button
          type="button"
          variant="secondary"
          disabled={!hasChanges || isPending}
          onClick={saveSettings}
        >
          {isPending ? <LoaderCircle className="animate-spin" /> : null}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
