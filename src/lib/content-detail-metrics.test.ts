import { describe, expect, it } from "vitest";
import {
  buildMainMetricCards,
  buildSecondaryMetricGroups,
} from "@/lib/content-detail-metrics";

describe("content detail metrics", () => {
  it("arma las metricas principales con aliases", () => {
    const cards = buildMainMetricCards({
      viewCount: 1200,
      likes: 110,
      comment_count: 12,
      share_count: 8,
      saved_count: 14,
    });

    expect(cards.map((card) => card.value)).toEqual([1200, 110, 12, 8, 14]);
  });

  it("prioriza views sobre reach en la metrica principal", () => {
    const cards = buildMainMetricCards({
      views: 70321,
      reach: 50260,
    });

    expect(cards[0]?.value).toBe(70321);
  });

  it("agrupa metricas secundarias sin duplicar principales", () => {
    const groups = buildSecondaryMetricGroups({
      reach: 900,
      total_interactions: 240,
      profile_views: 35,
      website_clicks: 7,
      ig_reels_avg_watch_time: 44000,
      ig_reels_video_view_total_time: 1800000,
      reels_skip_rate: 23.2,
      views: 1200,
      comments: 24,
      shares: 18,
      saves: 30,
      likes: 168,
    });

    expect(groups.map((group) => group.key)).toEqual(["performance", "retention", "rates"]);
    expect(groups[0]?.cards.map((card) => card.label)).toEqual([
      "Reach",
      "Interacciones",
      "Visitas perfil",
      "Clics link",
    ]);
    expect(groups[1]?.cards.map((card) => card.label)).toContain("Tiempo promedio visto");
    expect(groups[2]?.cards.map((card) => card.label)).toEqual([
      "Engagement rate",
      "Comment rate",
      "Share rate",
      "Save rate",
    ]);
  });

  it("muestra las metricas avanzadas de YouTube con sus unidades", () => {
    const groups = buildSecondaryMetricGroups({
      averageViewDurationSeconds: 102,
      averageViewPercentage: 48.5,
      watchTimeMinutes: 2040,
      subscribersGained: 18,
    });
    const cards = groups.flatMap((group) => group.cards);

    expect(cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Suscriptores ganados", formattedValue: "18" }),
        expect.objectContaining({ label: "Duracion media", formattedValue: "1 m 42 s" }),
        expect.objectContaining({ label: "Porcentaje visto", formattedValue: "48.5%" }),
        expect.objectContaining({ label: "Tiempo visto", value: 2040 }),
      ]),
    );
  });
});
