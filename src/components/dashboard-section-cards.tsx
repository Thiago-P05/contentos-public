"use client";

import {
  Activity,
  ArrowDown,
  ArrowUp,
  Bookmark,
  Eye,
  Heart,
  Link,
  MessageCircle,
  MousePointerClick,
  Play,
  Share2,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardTrendMetricKey } from "@/lib/types";

type StatCard = {
  key: DashboardTrendMetricKey;
  label: string;
  value: string;
  hint?: string;
  comparison: { value: number; label?: string } | null;
};

type Props = {
  cards: StatCard[];
  selectedMetric: DashboardTrendMetricKey;
  onMetricChange: (metric: DashboardTrendMetricKey) => void;
};

const METRIC_ICONS: Partial<Record<DashboardTrendMetricKey, LucideIcon>> = {
  views: Play,
  reach: Eye,
  contentInteractions: MousePointerClick,
  comments: MessageCircle,
  follows: UserPlus,
  followerCount: Users,
  profileVisits: Eye,
  linkClicks: Link,
  likes: Heart,
  shares: Share2,
  saves: Bookmark,
  engagementRate: Activity,
  likeRate: Heart,
  commentRate: MessageCircle,
  shareRate: Share2,
  saveRate: Bookmark,
  profileCtr: MousePointerClick,
  linkCtr: Link,
  followConversion: UserPlus,
  avgViewsPerPiece: Play,
};

export function DashboardSectionCards({ cards, selectedMetric, onMetricChange }: Props) {
  return (
    <div
      className="grid ds-animate-in ds-delay-2"
      style={{ gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))` }}
    >
      {cards.map((card, index) => {
        const isActive = card.key === selectedMetric;
        const comp = card.comparison;
        const compUp = comp && comp.value > 0;
        const compDown = comp && comp.value < 0;
        const compIsZero = comp && comp.value === 0;
        const compLabel = comp
          ? compIsZero && comp.label
            ? comp.label
            : `${compUp ? "+" : ""}${comp.value.toFixed(1)}%`
          : null;

        const Icon = METRIC_ICONS[card.key];

        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onMetricChange(card.key)}
            className={cn(
              "bg-card p-4 text-left transition-colors hover:bg-surface-elevated",
              index > 0 && "border-l border-border",
              isActive && "bg-surface-elevated ring-1 ring-inset ring-success/50",
            )}
          >
            {/* Label row: icon + label left, delta right */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {Icon ? <Icon className="size-3.5 shrink-0" /> : null}
                <span>{card.label}</span>
              </div>
              {compLabel ? (
                <div
                  className={cn(
                    "flex items-center gap-0.5 text-xs",
                    compUp ? "text-success" : compDown ? "text-danger" : "text-muted-foreground",
                  )}
                >
                  {compUp ? (
                    <ArrowUp className="size-3" />
                  ) : compDown ? (
                    <ArrowDown className="size-3" />
                  ) : null}
                  <span>{compLabel}</span>
                </div>
              ) : card.hint ? (
                <span className="text-label text-muted-foreground">{card.hint}</span>
              ) : null}
            </div>

            {/* Value */}
            <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
              {card.value}
            </div>
          </button>
        );
      })}
    </div>
  );
}
