import { describe, expect, it } from "vitest";
import {
  averageMetricsOf,
  METRIC_AGGREGATION,
  sumMetricsOf,
} from "@/lib/metric-aggregation";
import type { DashboardTrendMetricKey } from "@/lib/types";

describe("metric aggregation helpers", () => {
  it("particiona metricas y mantiene las clasificaciones de follows", () => {
    const keys: DashboardTrendMetricKey[] = [
      "views",
      "followerCount",
      "follows",
      "skipRate",
    ];

    expect(sumMetricsOf(keys)).toEqual(["views", "follows"]);
    expect(averageMetricsOf(keys)).toEqual(["followerCount", "skipRate"]);
    expect(METRIC_AGGREGATION.follows).toBe("sum");
    expect(METRIC_AGGREGATION.followerCount).toBe("average");
  });
});
