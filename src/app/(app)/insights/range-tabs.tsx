import Link from "next/link";

import { cn } from "@/lib/utils";
import { DEFAULT_RANGE, TIME_RANGES, type TimeRange } from "@/lib/analytics";

/**
 * Time-range selector (PRD 16.1). Plain links so the page stays a server component and each
 * range is a shareable URL; the default range keeps a clean `/insights` URL. The active
 * link is marked with `aria-current` and does not rely on colour alone.
 */
export function RangeTabs({ active }: { active: TimeRange }) {
  return (
    <nav
      aria-label="Time range"
      className="flex gap-1 rounded-full bg-muted p-1 text-sm"
    >
      {TIME_RANGES.map((range) => {
        const isActive = range.value === active;
        return (
          <Link
            key={range.value}
            href={
              range.value === DEFAULT_RANGE
                ? "/insights"
                : `/insights?range=${range.value}`
            }
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex h-8 items-center justify-center rounded-full px-3.5 text-center font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-foreground/70 hover:text-foreground",
            )}
          >
            {range.shortLabel}
          </Link>
        );
      })}
    </nav>
  );
}
