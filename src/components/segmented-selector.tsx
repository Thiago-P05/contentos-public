import Link from "next/link";
import { cn } from "@/lib/utils";

type SegmentedOption = {
  label: string;
  value: string;
};

type Props = {
  options: SegmentedOption[];
  active: string;
  buildHref: (value: string) => string;
  className?: string;
};

/** Link-based segmented control used by the dashboard and audience filters. */
export function SegmentedSelector({ options, active, buildHref, className }: Props) {
  return (
    <div
      className={cn(
        "flex items-center rounded-lg border border-border bg-secondary p-1 shadow-float",
        className,
      )}
    >
      {options.map((option) => {
        const isActive = option.value === active;

        return (
          <Link
            key={option.value}
            href={buildHref(option.value)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex h-7 items-center rounded-md px-3 text-xs transition-colors",
              isActive
                ? "bg-surface-hover text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
