import type { PlatformConnectionBriefFields } from "@/lib/types";

export function buildBriefSection(brief: PlatformConnectionBriefFields) {
  return [
    "Contexto estrategico de la cuenta:",
    "Oferta: " + brief.offer,
    "Cliente ideal: " + brief.idealCustomerProfile,
    "Dolor central: " + brief.corePain,
    "Resultado deseado: " + brief.desiredOutcome,
    "Diferenciador: " + brief.differentiator,
    "Tono: " + brief.toneGuidelines,
    "Evitar: " + brief.avoidGuidelines,
    "CTA principal: " + brief.primaryCta,
    brief.notes.trim() ? "Notas: " + brief.notes : null,
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join("\n");
}
