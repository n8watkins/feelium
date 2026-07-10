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
      className="flex gap-1 rounded-lg bg-muted p-1 text-sm"
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
              "flex-1 rounded-md px-2 py-1.5 text-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {range.shortLabel}
          </Link>
        );
      })}
    </nav>
  );
}
