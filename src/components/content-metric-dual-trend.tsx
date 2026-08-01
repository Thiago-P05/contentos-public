"use client";

import { useState } from "react";
import type { ContentDetailTrendPoint } from "@/lib/content-detail-trends";
import { formatCompactNumber } from "@/lib/format";

type MetricKey = "views" | "comments";

type CoordinatePoint = {
  x: number;
  y: number;
  value: number;
};

const X_TICK_LIMIT = 6;
const X_TICK_SHOW_ALL_LIMIT = 12;
const Y_TICK_STEPS = 4;

const METRIC_OPTIONS: Array<{
  key: MetricKey;
  label: string;
  shortLabel: string;
  color: string;
}> = [
  { key: "views", label: "Views", shortLabel: "Views", color: "var(--color-views)" },
  { key: "comments", label: "Comentarios", shortLabel: "Com.", color: "var(--color-follows)" },
];

function buildCurvedLine(points: CoordinatePoint[]) {
  if (points.length < 2) {
    return points.length === 1
      ? "M " + points[0]!.x + " " + points[0]!.y
      : "";
  }

  let path = "M " + points[0]!.x + " " + points[0]!.y;

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]!;
    const next = points[index + 1]!;
    const controlX = (current.x + next.x) / 2;
    path +=
      " C " +
      controlX +
      " " +
      current.y +
      ", " +
      controlX +
      " " +
      next.y +
      ", " +
      next.x +
      " " +
      next.y;
  }

  return path;
}

function buildTickIndices(total: number, limit = X_TICK_LIMIT) {
  if (total <= 0) {
    return [] as number[];
  }

  if (total <= limit) {
    return Array.from({ length: total }, (_, index) => index);
  }

  const step = (total - 1) / (limit - 1);
  const indices = Array.from({ length: limit }, (_, index) =>
    Math.round(index * step),
  );

  return [...new Set(indices)].sort((left, right) => left - right);
}

function buildCoordinates(values: number[], maxValue: number, chartLeft: number, chartBottom: number, chartWidth: number, chartHeight: number) {
  return values.map((value, index, source) => {
    const x =
      source.length === 1
        ? chartLeft + chartWidth / 2
        : chartLeft + (index / (source.length - 1)) * chartWidth;
    const y = maxValue > 0
      ? chartBottom - (value / maxValue) * chartHeight
      : chartBottom;

    return { x, y, value };
  });
}

export function ContentMetricDualTrend({
  points,
}: {
  points: ContentDetailTrendPoint[];
}) {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("views");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <article className="ds-card relative overflow-hidden rounded-lg p-5 sm:p-6">
        <p className="ds-label">
          Contenido
        </p>
        <p className="mt-2 text-[1.4rem] font-semibold tracking-display text-foreground">
          Evolucion de views y comentarios
        </p>
        <div className="mt-5 flex min-h-56 items-center justify-center rounded-md bg-surface-elevated text-body text-muted-foreground shadow-[var(--shadow-ring-light)]">
          Sin historial diario para views/comentarios.
        </div>
      </article>
    );
  }

  const selectedOption =
    METRIC_OPTIONS.find((option) => option.key === selectedMetric) ?? METRIC_OPTIONS[0]!;
  const chartLeft = 1.5;
  const chartTop = 2;
  const chartBottom = 30;
  const chartRight = 90.5;
  const chartAxisLabelX = 98.8;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;
  const step =
    points.length === 1
      ? chartWidth
      : chartWidth / Math.max(points.length - 1, 1);

  const values = points.map((point) => point[selectedOption.key]);
  const rawMax = Math.max(...values, 0);
  const yMax = rawMax > 0 ? rawMax * 1.15 : 1;
  const coordinates = buildCoordinates(values, yMax, chartLeft, chartBottom, chartWidth, chartHeight);
  const linePath = buildCurvedLine(coordinates);
  const first = coordinates[0]!;
  const last = coordinates[coordinates.length - 1]!;
  const areaPath =
    linePath +
    " L " +
    last.x +
    " " +
    chartBottom +
    " L " +
    first.x +
    " " +
    chartBottom +
    " Z";
  const hoveredPoint = hoveredIndex === null ? null : points[hoveredIndex] ?? null;
  const hoveredCoordinate =
    hoveredIndex === null ? null : coordinates[hoveredIndex] ?? null;
  const xTickIndices =
    points.length <= X_TICK_SHOW_ALL_LIMIT
      ? Array.from({ length: points.length }, (_, index) => index)
      : buildTickIndices(points.length);
  const xTicks = xTickIndices.map((index) => ({
    x: coordinates[index]!.x,
    label: points[index]!.label,
    index,
  }));
  const yTicks = Array.from({ length: Y_TICK_STEPS + 1 }, (_, index) => {
    const ratio = index / Y_TICK_STEPS;
    const value = yMax * (1 - ratio);

    return {
      value,
      y: chartTop + ratio * chartHeight,
    };
  });
  const gradientId = `content-chart-gradient-${selectedOption.key}`;
  const description = "Cada punto representa el valor diario observado para este video.";

  return (
    <article className="ds-card relative overflow-hidden rounded-lg p-5 sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="ds-label mb-1">
            Contenido
          </p>
          <p className="mt-1 text-[1.4rem] font-semibold tracking-display text-foreground">
            Evolucion de views y comentarios
          </p>
          <p className="mt-2 text-body-sm text-muted-foreground">{description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {METRIC_OPTIONS.map((option) => {
            const isActive = selectedOption.key === option.key;

            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setSelectedMetric(option.key)}
                className={[
                  "px-1 py-1.5 text-caption transition-colors border-b-2 font-medium tracking-normal whitespace-nowrap",
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 rounded-md bg-surface px-0 pb-2 pt-2 shadow-[var(--shadow-ring-light)] sm:px-0 sm:pb-3 sm:pt-3">
        <div className="relative">
          {hoveredPoint && hoveredCoordinate ? (
            <div
              className="pointer-events-none absolute z-10 rounded-md bg-surface px-3 py-2 shadow-[var(--shadow-card-full)]"
              style={{
                left: String(hoveredCoordinate.x) + "%",
                top: "6%",
                transform: "translate(-50%, 0)",
              }}
            >
              <p className="font-mono text-label uppercase tracking-caps text-muted-foreground/70">
                {hoveredPoint.label}
              </p>
              <div className="mt-2 flex items-center gap-2 text-body-sm">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: selectedOption.color }}
                />
                <span className="text-muted-foreground">{selectedOption.shortLabel}</span>
                <span className="ml-auto text-foreground">
                  {formatCompactNumber(hoveredPoint[selectedOption.key])}
                </span>
              </div>
            </div>
          ) : null}

          <svg viewBox="0 0 100 32" className="h-[23rem] w-full overflow-visible">
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={selectedOption.color} stopOpacity="0.20" />
                <stop offset="85%" stopColor={selectedOption.color} stopOpacity="0.03" />
              </linearGradient>
            </defs>

            {yTicks.map((tick, index) => (
              <line
                key={`y-grid-${index}`}
                x1="0"
                x2={chartRight}
                y1={tick.y}
                y2={tick.y}
                stroke="var(--line)"
                strokeWidth={index === Y_TICK_STEPS ? "0.2" : "0.16"}
              />
            ))}

            <line
              x1={chartRight}
              x2={chartRight}
              y1={chartTop}
              y2={chartBottom}
              stroke="var(--line)"
              strokeWidth="0.16"
            />

            {yTicks.map((tick, index) => (
              <text
                key={`y-label-${index}`}
                x={chartAxisLabelX}
                y={tick.y + 0.35}
                textAnchor="end"
                className="fill-muted"
                fontSize="1.35"
              >
                {formatCompactNumber(tick.value)}
              </text>
            ))}

            {coordinates.length > 1 ? (
              <path d={areaPath} fill={`url(#${gradientId})`} />
            ) : null}

            <path
              d={linePath}
              fill="none"
              stroke={selectedOption.color}
              style={{ strokeWidth: "0.22" }}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {coordinates.map((point, index) => (
              <circle
                key={selectedOption.key + "-point-" + index}
                cx={point.x}
                cy={point.y}
                r={hoveredIndex === index ? "0.42" : "0.3"}
                fill={selectedOption.color}
                stroke="var(--background)"
                strokeWidth="0.08"
              />
            ))}

            {hoveredCoordinate ? (
              <g>
                <line
                  x1={hoveredCoordinate.x}
                  x2={hoveredCoordinate.x}
                  y1={chartTop}
                  y2={chartBottom}
                  stroke="var(--line-strong)"
                  strokeWidth="0.18"
                />
                <circle
                  cx={hoveredCoordinate.x}
                  cy={hoveredCoordinate.y}
                  r="0.62"
                  fill="var(--background)"
                  stroke={selectedOption.color}
                  strokeWidth="0.14"
                />
                <circle
                  cx={hoveredCoordinate.x}
                  cy={hoveredCoordinate.y}
                  r="0.27"
                  fill={selectedOption.color}
                />
              </g>
            ) : null}

            {points.map((point, index) => {
              const x =
                points.length === 1
                  ? chartLeft + chartWidth / 2
                  : chartLeft + (index / (points.length - 1)) * chartWidth;
              const rectWidth = points.length === 1 ? chartWidth : step;
              const rectX =
                points.length === 1
                  ? chartLeft
                  : Math.max(0, x - rectWidth / 2);

              return (
                <rect
                  key={point.capturedAt}
                  x={rectX}
                  y="0"
                  width={rectWidth}
                  height="32"
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() =>
                    setHoveredIndex((current) =>
                      current === index ? null : current,
                    )
                  }
                />
              );
            })}

            {xTicks.map((tick) => (
              <text
                key={`x-label-${tick.index}`}
                x={tick.x}
                y="31.45"
                textAnchor={
                  tick.index === 0
                    ? "start"
                    : tick.index === points.length - 1
                      ? "end"
                      : "middle"
                }
                className="fill-muted"
                fontSize="1.35"
              >
                {tick.label}
              </text>
            ))}
          </svg>
        </div>
      </div>
    </article>
  );
}
