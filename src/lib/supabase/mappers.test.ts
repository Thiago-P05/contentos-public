import { describe, expect, it } from "vitest";
import { encryptSecret } from "@/lib/secure";
import {
  getLatestMetrics,
  toAIInsight,
  toMetricSnapshot,
  toPlatformConnectionBrief,
  toPlatformConnectionCredentials,
} from "@/lib/supabase/mappers";
import type { AIInsightRow, ConnectionBriefRow, ConnectionRow, SnapshotRow } from "@/lib/supabase/types";

describe("supabase mappers", () => {
  it("desencripta credenciales de conexion", () => {
    process.env.CONNECTION_ENCRYPTION_SECRET = "super-secret-key-for-tests";

    const row: ConnectionRow = {
      id: "connection-1",
      platform: "instagram",
      account_external_id: "123",
      account_username: "cuenta",
      display_name: "Cuenta",
      access_token_encrypted: encryptSecret("access-token"),
      refresh_token_encrypted: encryptSecret("refresh-token"),
      token_expires_at: null,
      refresh_token_expires_at: null,
      scopes: [],
      status: "active",
      raw_profile: {},
      created_at: "2026-03-01T00:00:00.000Z",
      updated_at: "2026-03-01T00:00:00.000Z",
    };

    const credentials = toPlatformConnectionCredentials(row);

    expect(credentials.accessToken).toBe("access-token");
    expect(credentials.refreshToken).toBe("refresh-token");
    expect(credentials.autoAnalysisEnabled).toBe(true);
    expect(credentials.autoTranscriptionEnabled).toBe(true);
  });

  it("elige la metrica mas reciente por contenido", () => {
    const snapshots: SnapshotRow[] = [
      {
        id: "s1",
        content_item_id: "content-1",
        source_platform: "instagram",
        captured_at: "2026-03-10T00:00:00.000Z",
        metrics: { views: 10 },
        raw_payload: {},
        created_at: "2026-03-10T00:00:00.000Z",
      },
      {
        id: "s2",
        content_item_id: "content-1",
        source_platform: "instagram",
        captured_at: "2026-03-12T00:00:00.000Z",
        metrics: { views: 20 },
        raw_payload: {},
        created_at: "2026-03-12T00:00:00.000Z",
      },
      {
        id: "s3",
        content_item_id: "content-2",
        source_platform: "instagram",
        captured_at: "2026-03-11T00:00:00.000Z",
        metrics: { views: 30 },
        raw_payload: {},
        created_at: "2026-03-11T00:00:00.000Z",
      },
    ];

    const latest = getLatestMetrics(snapshots.map(toMetricSnapshot));

    expect(latest.get("content-1")?.metrics.views).toBe(20);
    expect(latest.get("content-2")?.metrics.views).toBe(30);
  });
});


describe("extended AI insight mapping", () => {
  it("mapea improvements, evidencia y potencial", () => {
    const row: AIInsightRow = {
      id: "insight-1",
      content_item_id: "content-1",
      summary: "Resumen",
      strengths: ["Claro"],
      weaknesses: ["CTA flojo"],
      improvements: ["Pedir comentario con palabra"],
      topics: ["IA"],
      hooks: ["Tu competencia ya usa IA"],
      hook_type: "problema_dolor",
      hook_assessment: "Abre bien pero le falta especificidad.",
      evidence_mode: "text_plus_cover",
      confidence: 0.8,
      model: "gemini-text",
      raw_payload: {
        videoPotential: {
          horizonDays: 7,
          views: { low: 1000, expected: 2000, high: 3000 },
          reach: { low: 800, expected: 1600, high: 2400 },
          comments: { low: 5, expected: 12, high: 25 },
          confidence: 0.7,
          rationale: "Tiene buen hook.",
        },
      },
      created_at: "2026-03-01T00:00:00.000Z",
      updated_at: "2026-03-01T00:00:00.000Z",
    };

    const insight = toAIInsight(row);

    expect(insight.improvements).toEqual(["Pedir comentario con palabra"]);
    expect(insight.hookType).toBe("problema_dolor");
    expect(insight.evidenceMode).toBe("text_plus_cover");
    expect(insight.videoPotential?.views.expected).toBe(2000);
  });


});
describe("platform connection brief mapping", () => {
  it("mapea el brief de cuenta", () => {
    const row: ConnectionBriefRow = {
      id: "brief-1",
      connection_id: "connection-1",
      offer: "Oferta",
      ideal_customer_profile: "Cliente ideal",
      core_pain: "Dolor",
      desired_outcome: "Resultado",
      differentiator: "Diferenciador",
      tone_guidelines: "Tono",
      avoid_guidelines: "Evitar",
      primary_cta: "CTA",
      notes: "Notas",
      created_at: "2026-03-01T00:00:00.000Z",
      updated_at: "2026-03-01T00:00:00.000Z",
    };

    const brief = toPlatformConnectionBrief(row);

    expect(brief.connectionId).toBe("connection-1");
    expect(brief.primaryCta).toBe("CTA");
    expect(brief.notes).toBe("Notas");
  });
});
