import { describe, expect, it } from "vitest";
import { parseCompetitionReport } from "@/lib/competition/analysis";

describe("competition analysis parsing", () => {
  it("accepts arrays of plain strings", () => {
    const report = parseCompetitionReport(
      JSON.stringify({
        summary: "Resumen simple",
        winningFormats: ["Reels cortos"],
        winningTopics: ["IA aplicada"],
        recurringHooks: ["3 errores comunes"],
        observations: ["Publica seguido"],
        caveats: ["Métricas visibles parciales"],
      }),
    );

    expect(report.summary).toBe("Resumen simple");
    expect(report.winningFormats).toEqual(["Reels cortos"]);
  });

  it("normalizes arrays of objects returned by the model", () => {
    const report = parseCompetitionReport(
      JSON.stringify({
        summary: "Resumen con objetos",
        winningFormats: [{ label: "Reels", reason: "Más views visibles" }],
        winningTopics: [{ name: "IA aplicada" }, { topic: "Automatización", why: "Alta repetición" }],
        recurringHooks: [{ hook: "3 errores", explanation: "Promesa concreta" }],
        observations: [{ text: "Sube contenido educativo" }],
        caveats: [{ description: "No todos los posts exponen views" }],
      }),
    );

    expect(report.winningFormats).toEqual(["Reels: Más views visibles"]);
    expect(report.winningTopics).toEqual(["IA aplicada", "Automatización: Alta repetición"]);
    expect(report.recurringHooks).toEqual(["3 errores: Promesa concreta"]);
    expect(report.observations).toEqual(["Sube contenido educativo"]);
    expect(report.caveats).toEqual(["No todos los posts exponen views"]);
  });
});
