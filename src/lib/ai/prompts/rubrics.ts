import type { InsightPromptProfile } from "@/lib/ai/prompts/types";

export function buildPromptStrategy(profile: InsightPromptProfile) {
  switch (profile) {
    case "instagram_story":
      return [
        "Analiza la pieza como historia de Instagram, priorizando inmediatez, claridad en segundos, continuidad entre frames, cercania y urgencia.",
        "En strengths y weaknesses enfocate en claridad visual, velocidad de comprension, secuencia y llamada a la accion.",
        "En improvements propone ajustes concretos de secuencia, texto y CTA.",
      ].join("\n");
    case "carousel":
      return [
        "Analiza la pieza como carrusel para empresarios no tecnicos interesados en IA aplicada al negocio.",
        "Rubrica obligatoria: fuerza de slide 1, claridad de la promesa, secuencia entre laminas, densidad de texto, legibilidad, progresion de idea, payoff final y CTA a comentario.",
        "Evalua explicitamente si la pieza le habla a un empresario no tecnico, si conecta con tiempo, familia o dinero, si la solucion se entiende simple, si el CTA empuja a comentar una palabra y si evita tecnicismos innecesarios.",
      ].join("\n");
    case "long_video":
      return [
        "Analiza la pieza como video largo de YouTube para empresarios no tecnicos interesados en IA aplicada al negocio.",
        "Rubrica obligatoria: promesa de titulo y portada, hook inicial, estructura, progresion de idea, claridad, densidad, momentos de retencion, credibilidad y CTA final.",
        "No evalues elementos que no esten disponibles en la evidencia. Si solo tenes titulo, descripcion y portada, limita tus observaciones a esos elementos.",
      ].join("\n");
    default:
      return [
        "Analiza la pieza como video corto para Instagram o TikTok orientado a empresarios no tecnicos interesados en IA aplicada al negocio.",
        "Rubrica obligatoria: hook en primeros segundos, claridad verbal, simpleza del mensaje, delivery, visual hook, texto en pantalla, subtitulos, ritmo, credibilidad y CTA a comentario.",
        "Evalua explicitamente si la pieza le habla a un empresario no tecnico, si conecta con tiempo, familia o dinero, si la solucion se entiende simple, si el CTA empuja a comentar una palabra y si evita tecnicismos innecesarios.",
      ].join("\n");
  }
}
