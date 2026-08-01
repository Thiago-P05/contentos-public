import type { AnalysisEvidenceMode } from "@/lib/types";

export function getInsightEvidenceModeNote(evidenceMode: AnalysisEvidenceMode) {
  switch (evidenceMode) {
    case "text_plus_cover":
      return "Este analisis se hizo con texto y portada disponible, pero sin ver el video completo.";
    case "text_only":
      return "Este analisis se hizo solo con texto o metadata disponible, sin evidencia visual directa.";
    default:
      return null;
  }
}