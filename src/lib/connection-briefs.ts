import type { PlatformConnectionBriefFields } from "@/lib/types";

export const DEFAULT_PLATFORM_CONNECTION_BRIEF_FIELDS: PlatformConnectionBriefFields = {
  offer: "Ahorro tiempo y dinero a empresas con Inteligencia Artificial.",
  idealCustomerProfile:
    "Hombre de 35 a 45 anos, dueno de una pyme o empresa estable, con familia, estabilidad economica y poco tiempo. Tiene bajo conocimiento tecnico en inteligencia artificial, pero quiere crecer la empresa, ahorrar tiempo y ganar mas dinero sin sacrificar su vida personal.",
  corePain:
    "Le falta tiempo. Siente que el negocio depende demasiado de el, no puede dedicarle el tiempo que quiere a su familia, quiere aprender y crecer pero no llega.",
  desiredOutcome:
    "Quiere recuperar tiempo, crecer la empresa sin estar pendiente todo el dia y ganar mas dinero sin sacrificar a su familia.",
  differentiator:
    "Conozco bien los problemas del empresario pyme y tengo experiencia aplicando inteligencia artificial y automatizaciones en empresas para resolverlos de forma realista.",
  toneGuidelines:
    "Profesional, educado y tranquilo. Claro, simple y directo. Sin tecnicismos innecesarios. Tiene que sonar entendible para alguien no tecnico.",
  avoidGuidelines:
    "Evitar tono demasiado tecnico, academico, marketinero, soberbio o exageradamente vendedor. No recomendar complejidad innecesaria ni jerga dificil.",
  primaryCta:
    "Buscar que la audiencia comente una palabra para abrir conversacion por Instagram DM y prospectar desde ahi.",
  notes: "",
};

export function getDefaultPlatformConnectionBriefFields(): PlatformConnectionBriefFields {
  return {
    ...DEFAULT_PLATFORM_CONNECTION_BRIEF_FIELDS,
  };
}