import {
  Activity,
  Bookmark,
  Clock,
  Eye,
  Heart,
  Link,
  MessageCircle,
  MousePointerClick,
  Play,
  Share2,
  Timer,
  TrendingDown,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const KEY_ICONS: Record<string, LucideIcon> = {
  views: Play,
  reach: Eye,
  likes: Heart,
  comments: MessageCircle,
  shares: Share2,
  saves: Bookmark,
  impressions: Eye,
  impressionsClickThroughRate: MousePointerClick,
  contentInteractions: MousePointerClick,
  profileVisits: Eye,
  linkClicks: Link,
  follows: UserPlus,
  engagementRate: Activity,
  likeRate: Heart,
  commentRate: MessageCircle,
  shareRate: Share2,
  saveRate: Bookmark,
  avgWatchTimeMs: Timer,
  watchTimeMinutes: Clock,
  averageViewDurationSeconds: Timer,
  averageViewPercentage: Activity,
  subscribersGained: UserPlus,
  skipRate: TrendingDown,
};

type Props = {
  label: string;
  value: string;
  metricKey?: string;
  index?: number;
};

export function ContentStatCard({ label, value, metricKey, index = 0 }: Props) {
  const Icon = metricKey ? (KEY_ICONS[metricKey] ?? Activity) : Activity;

  return (
    <div
      className={cn(
        "bg-card p-4",
        index > 0 && "border-l border-border",
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0" />
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}
