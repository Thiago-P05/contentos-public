import { describe, expect, it } from "vitest";
import {
  getVideoPotentialFromPayload,
  parseVideoPotentialEstimate,
} from "@/lib/ai/video-potential";

describe("video potential parser", () => {
  it("normaliza estimaciones de potencial a 7 dias", () => {
    const potential = parseVideoPotentialEstimate({
      horizonDays: 30,
      views: { low: 5000, expected: 8000, high: 12000 },
      reach: { low: 4200, expected: 7000, high: 10000 },
      comments: { low: 12, expected: 28, high: 48 },
      confidence: "0.72",
      rationale: "Hook claro y tema probado.",
    });

    expect(potential).toEqual({
      horizonDays: 7,
      views: { low: 5000, expected: 8000, high: 12000 },
      reach: { low: 4200, expected: 7000, high: 10000 },
      comments: { low: 12, expected: 28, high: 48 },
      confidence: 0.72,
      rationale: "Hook claro y tema probado.",
    });
  });

  it("ordena rangos desordenados del modelo", () => {
    const potential = parseVideoPotentialEstimate({
      views: { low: 900, expected: 100, high: 500 },
      reach: { low: 700, expected: 300, high: 500 },
      comments: { low: 9, expected: 3, high: 6 },
      confidence: 0.5,
      rationale: "",
    });

    expect(potential?.views).toEqual({ low: 100, expected: 500, high: 900 });
    expect(potential?.comments).toEqual({ low: 3, expected: 6, high: 9 });
  });

  it("lee potencial guardado en raw_payload directo o parsed", () => {
    const payload = {
      parsed: {
        videoPotential: {
          views: { low: 100, expected: 200, high: 300 },
          reach: { low: 80, expected: 160, high: 240 },
          comments: { low: 1, expected: 4, high: 8 },
          confidence: 0.6,
          rationale: "Buen formato.",
        },
      },
    };

    expect(getVideoPotentialFromPayload(payload)?.views.expected).toBe(200);
  });
});
