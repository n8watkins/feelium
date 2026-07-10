import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { describeTrend, type Trend } from "@/lib/analytics";
import { Sparkline } from "./sparkline";

/**
 * A "basic trend over time" (PRD 16.2/16.3): a direction line plus a sparkline, always
 * paired with an equivalent screen-reader-only text summary listing each period's value
 * (PRD 24). The direction is conveyed by both an icon and words, never colour alone.
 */
export function TrendChart({
  trend,
  subject,
  formatValue,
  label,
}: {
  trend: Trend;
  subject: "occurrence" | "value";
  formatValue: (n: number) => string;
  label: string;
}) {
  const summary = describeTrend(trend.direction, subject);
  const Icon =
    trend.direction === "up"
      ? TrendingUp
      : trend.direction === "down"
        ? TrendingDown
        : Minus;

  const hasBars =
    trend.direction !== "insufficient" && trend.buckets.some((b) => b.value != null);

  const bucketText = trend.buckets
    .filter((b) => b.value != null)
    .map((b) => `${b.label}, ${formatValue(b.value as number)}`)
    .join("; ");

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        <span>{summary}</span>
      </div>
      {hasBars ? (
        <>
          <Sparkline
            buckets={trend.buckets}
            domainMin={trend.domainMin}
            domainMax={trend.domainMax}
          />
          <span className="sr-only">
            {label}. {summary}.
            {bucketText ? ` Values by period: ${bucketText}.` : ""}
          </span>
        </>
      ) : null}
    </div>
  );
}
