"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  getDashboardCurrentAnchor,
  getDashboardRangeLabel,
} from "@/lib/dashboard-range";
import type { DashboardRange } from "@/lib/types";

type Props = {
  range: DashboardRange;
  selectedAnchor: string | null;
  currentAnchor?: string | null;
};

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"] as const;

function formatDisplayDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function parseAnchorDate(value: string) {
  const [yearRaw, monthRaw, dayRaw] = value.split("-").map(Number);
  const year = Number.isFinite(yearRaw) ? yearRaw : 1970;
  const month = Number.isFinite(monthRaw) ? monthRaw : 1;
  const day = Number.isFinite(dayRaw) ? dayRaw : 1;
  return new Date(year, month - 1, day);
}

function formatAnchorDate(value: Date) {
  return format(value, "yyyy-MM-dd");
}

function formatMonthLabel(value: Date) {
  const label = format(value, "MMMM yyyy", { locale: es });
  return `${label.slice(0, 1).toUpperCase()}${label.slice(1)}`;
}

function getPreviewBounds(range: DashboardRange, anchor: Date) {
  switch (range) {
    case "day":
      return { start: anchor, end: anchor };
    case "week": {
      const start = startOfWeek(anchor, { weekStartsOn: 1 });
      return { start, end: endOfWeek(start, { weekStartsOn: 1 }) };
    }
    case "month": {
      const start = startOfMonth(anchor);
      return { start, end: endOfMonth(start) };
    }
    case "quarter": {
      const quarterStartMonth = Math.floor(anchor.getMonth() / 3) * 3;
      const start = new Date(anchor.getFullYear(), quarterStartMonth, 1);
      const end = endOfMonth(
        new Date(anchor.getFullYear(), quarterStartMonth + 2, 1),
      );
      return { start, end };
    }
    case "year": {
      const start = startOfYear(anchor);
      return { start, end: endOfYear(start) };
    }
    default:
      return null;
  }
}

export function DashboardDateFilter({
  range,
  selectedAnchor,
  currentAnchor: dataCurrentAnchor,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  const currentAnchor = dataCurrentAnchor ?? getDashboardCurrentAnchor();
  const resolvedAnchor = selectedAnchor ?? currentAnchor;
  const resolvedAnchorDate = useMemo(
    () => parseAnchorDate(resolvedAnchor),
    [resolvedAnchor],
  );
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(resolvedAnchorDate),
  );

  /* Close on outside click / Escape */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const pushAnchor = (anchor: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("anchor", anchor);
    router.push(`${pathname}?${next.toString()}`);
    setOpen(false);
  };

  const applyDate = (date: Date) => {
    const anchor = formatAnchorDate(date);
    setVisibleMonth(startOfMonth(date));
    pushAnchor(anchor);
  };

  const openPicker = () => {
    setVisibleMonth(startOfMonth(resolvedAnchorDate));
    setOpen(true);
  };

  /* Calendar grid */
  const monthStart = startOfMonth(visibleMonth);
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const previewBounds = getPreviewBounds(range, resolvedAnchorDate);

  /* Presets */
  const today = new Date();
  const PRESETS = [
    { label: "Hoy", date: today },
    { label: "Ayer", date: subDays(today, 1) },
    { label: "7 días", date: subDays(today, 7) },
    { label: "30 días", date: subDays(today, 30) },
    { label: "3 meses", date: subMonths(today, 3) },
  ];

  if (range === "all") return null;

  return (
    <div className="ds-animate-in ds-delay-1 relative isolate z-[120] flex flex-wrap items-center gap-2">
      {/* Quick nav: Actual */}
      <button
        type="button"
        onClick={() => pushAnchor(currentAnchor)}
        className="rounded-full border border-line bg-surface px-3.5 py-2 text-body-sm text-muted-foreground transition hover:border-line-strong hover:bg-surface-elevated hover:text-foreground"
      >
        Actual
      </button>

      {/* Calendar trigger */}
      <div ref={popoverRef} className="relative">
        <button
          type="button"
          onClick={openPicker}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-body-sm text-muted-foreground transition hover:border-line-strong hover:bg-surface-elevated hover:text-foreground"
        >
          <CalendarDays className="size-3.5" />
          Fecha: {formatDisplayDate(resolvedAnchor)}
        </button>

        {open ? (
          <div className="absolute left-0 top-[calc(100%+8px)] z-[220]">
            <Card className="overflow-hidden" style={{ width: "296px" }}>
              <CardContent className="p-3">
                {/* Range label */}
                <p className="mb-3 text-caption text-muted-foreground">
                  Rango activo:{" "}
                  <span className="font-medium text-foreground">
                    {getDashboardRangeLabel(range)}
                  </span>
                </p>

                {/* Month navigation */}
                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleMonth((m) => subMonths(m, 1))
                    }
                    className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-surface-elevated hover:text-foreground"
                    aria-label="Mes anterior"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <p className="text-body font-medium text-foreground">
                    {formatMonthLabel(visibleMonth)}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleMonth((m) => addMonths(m, 1))
                    }
                    className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-surface-elevated hover:text-foreground"
                    aria-label="Mes siguiente"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>

                {/* Weekday headers */}
                <div className="mb-1 grid grid-cols-7 text-center" style={{ width: "7rem * 7" }}>
                  {WEEKDAY_LABELS.map((label) => (
                    <span
                      key={label}
                      className="w-10 py-1 text-center text-caption font-medium text-muted-foreground"
                    >
                      {label}
                    </span>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7">
                  {calendarDays.map((day, index) => {
                    const inCurrentMonth = isSameMonth(day, monthStart);
                    const todayDay = isToday(day);
                    const inRange = previewBounds
                      ? !isBefore(day, previewBounds.start) &&
                        !isAfter(day, previewBounds.end)
                      : false;
                    const isRangeStart = previewBounds
                      ? isSameDay(day, previewBounds.start)
                      : false;
                    const isRangeEnd = previewBounds
                      ? isSameDay(day, previewBounds.end)
                      : false;
                    const isMiddle = inRange && !isRangeStart && !isRangeEnd;
                    const isRowStart = index % 7 === 0;
                    const isRowEnd = index % 7 === 6;

                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => applyDate(day)}
                        className={[
                          "h-9 w-10 text-body-sm transition-colors focus:outline-none",
                          isRangeStart || isRangeEnd
                            ? "bg-foreground font-semibold text-background"
                            : isMiddle
                              ? "bg-surface-elevated text-foreground"
                              : inCurrentMonth
                                ? "text-foreground hover:bg-surface-elevated"
                                : "text-muted-foreground/40",
                          isRangeStart || (isMiddle && isRowStart)
                            ? "rounded-l-md"
                            : "rounded-none",
                          isRangeEnd || (isMiddle && isRowEnd)
                            ? "rounded-r-md"
                            : "rounded-none",
                          !inRange && !isRangeStart && !isRangeEnd
                            ? "rounded-md"
                            : "",
                          todayDay && !inRange
                            ? "ring-1 ring-inset ring-muted-foreground/20"
                            : "",
                        ].join(" ")}
                      >
                        {format(day, "d")}
                      </button>
                    );
                  })}
                </div>
              </CardContent>

              {/* Presets */}
              <CardFooter className="flex flex-wrap gap-1.5 border-t px-3 py-3">
                {PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => applyDate(preset.date)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </CardFooter>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
