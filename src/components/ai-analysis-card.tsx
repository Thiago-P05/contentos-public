import { BrainCircuit } from "lucide-react";
import { getInsightEvidenceModeNote } from "@/lib/ai/insight-display";
import { formatDateTime } from "@/lib/format";
import type { AIInsight, AnalysisStatus } from "@/lib/types";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

type Props = {
  insight: AIInsight | null;
  status: AnalysisStatus;
  updatedAt: string | null;
  error?: string | null;
  action?: ReactNode;
};

function getStatusLabel(status: AnalysisStatus, hasInsight: boolean) {
  if (hasInsight && status === "ready") return "Analizado";
  if (hasInsight && status === "fallback") return "Fallback";

  switch (status) {
    case "ready":
      return "Analizado";
    case "fallback":
      return "Fallback";
    case "processing":
      return "Procesando";
    case "failed":
      return "Fallo";
    default:
      return "Pendiente";
  }
}

function AnalysisList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="break-inside-avoid space-y-2">
      <p className="font-mono text-micro uppercase tracking-caps text-foreground">
        {label}
      </p>
      <ul className="space-y-1.5 text-body-sm leading-5 text-foreground">
        {items.slice(0, 5).map((item) => (
          <li key={item} className="border-l border-line pl-3">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AIAnalysisCard({ insight, status, updatedAt, error, action }: Props) {
  const statusLabel = getStatusLabel(status, Boolean(insight));
  const evidenceNote = insight ? getInsightEvidenceModeNote(insight.evidenceMode) : null;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        <p className="font-mono text-label uppercase tracking-caps text-muted-foreground">
          Analisis de IA
        </p>
      </div>

      <div className="glass-panel rounded-md px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
            <Badge variant="outline" className="uppercase tracking-caps">
              <BrainCircuit />
              {statusLabel}
            </Badge>
            {insight?.model ? <span>Modelo: {insight.model}</span> : null}
            {updatedAt ? <span>Actualizado: {formatDateTime(updatedAt)}</span> : null}
            {insight ? <span>Confianza: {Math.round(insight.confidence * 100)}%</span> : null}
          </div>
          {action}
        </div>

        {insight ? (
          <div className="mt-4 space-y-5">
            <p className="whitespace-pre-wrap text-body leading-6 text-foreground">
              {insight.summary}
            </p>

            {evidenceNote ? (
              <p className="rounded-sm border border-line bg-surface-elevated/60 px-3 py-2 text-caption leading-5 text-muted-foreground">
                {evidenceNote}
              </p>
            ) : null}

            <div className="columns-2 gap-6 space-y-4">
              <AnalysisList label="Fortalezas" items={insight.strengths} />
              <AnalysisList label="Mejoras" items={insight.improvements} />
              <AnalysisList label="Debilidades" items={insight.weaknesses} />
              <AnalysisList label="Temas" items={insight.topics} />
            </div>

            {insight.hooks.length > 0 || insight.hookAssessment ? (
              <div className="rounded-sm border border-line bg-surface-elevated/60 px-3 py-3">
                <p className="font-mono text-micro uppercase tracking-caps text-muted-foreground">
                  Hook
                </p>
                {insight.hooks.length > 0 ? (
                  <p className="mt-2 text-body leading-5 text-foreground">
                    {insight.hooks[0]}
                  </p>
                ) : null}
                {insight.hookAssessment ? (
                  <p className="mt-2 text-caption leading-5 text-muted-foreground">
                    {insight.hookAssessment}
                  </p>
                ) : null}
              </div>
            ) : null}

          </div>
        ) : null}

        {!insight && status === "pending" ? (
          <p className="mt-4 text-body text-muted-foreground">
            El analisis se generara en la proxima sincronizacion.
          </p>
        ) : null}

        {!insight && status === "failed" ? (
          <p className="mt-4 text-body text-danger">
            {error ?? "No se pudo generar el analisis de IA."}
          </p>
        ) : null}
      </div>
    </div>
  );
}
