import { buildBriefSection } from "@/lib/ai/prompts/brief";
import { buildOutputContract } from "@/lib/ai/prompts/contract";
import { buildPromptStrategy } from "@/lib/ai/prompts/rubrics";
import type { InsightPromptProfile } from "@/lib/ai/prompts/types";
import type {
  AnalysisEvidenceMode,
  AnalysisInput,
  PlatformConnectionBriefFields,
} from "@/lib/types";

function buildLimitationsSection(evidenceMode: AnalysisEvidenceMode) {
  switch (evidenceMode) {
    case "text_plus_cover":
      return "Limitacion: viste texto y portada, pero no el video completo. No afirmes cosas que dependan de haber visto toda la pieza en movimiento.";
    case "text_only":
      return "Limitacion: no hay evidencia visual directa. Analiza solo con el texto y metadata disponible. No inventes observaciones visuales.";
    default:
      return "Usa la evidencia visual real disponible antes de sacar conclusiones.";
  }
}

function getPromptProfileLabel(profile: InsightPromptProfile) {
  return profile;
}

export function buildStrategicAnalysisPrompt(params: {
  promptProfile: InsightPromptProfile;
  evidenceMode: AnalysisEvidenceMode;
  platform: string;
  analysisInput: AnalysisInput;
  brief: PlatformConnectionBriefFields;
}) {
  const { promptProfile, evidenceMode, platform, analysisInput, brief } = params;

  return [
    "Sos un analista senior de contenido para una sola marca.",
    "Tu trabajo es evaluar si una pieza sirve estrategicamente para el negocio segun el publico objetivo y el formato.",
    "No uses metricas de performance para juzgar la pieza. Juzgala por fit estrategico, claridad, hook, simpleza, fuerza visual y CTA.",
    buildOutputContract(),
    "Perfil de analisis: " + getPromptProfileLabel(promptProfile),
    "Modo de evidencia: " + evidenceMode,
    "Plataforma: " + platform,
    "Fuente principal: " + analysisInput.sourceType,
    buildBriefSection(brief),
    buildPromptStrategy(promptProfile),
    buildLimitationsSection(evidenceMode),
    "Texto base de la pieza:",
    analysisInput.content.slice(0, 12000),
  ].join("\n\n");
}
