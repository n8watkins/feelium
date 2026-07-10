import { type TrendBucket } from "@/lib/analytics";

/**
 * A tiny bar sparkline for a bucketed series. Purely decorative (aria-hidden): the
 * accessible text equivalent is rendered by TrendChart (PRD 24 - every chart has a text
 * summary and nothing relies on colour alone). Empty buckets keep a faint baseline so gaps
 * in recording stay visible instead of being smoothed away.
 */
export function Sparkline({
  buckets,
  domainMin,
  domainMax,
}: {
  buckets: TrendBucket[];
  domainMin: number;
  domainMax: number;
}) {
  const span = domainMax - domainMin || 1;
  return (
    <div className="flex h-12 items-end gap-1" aria-hidden="true">
      {buckets.map((bucket, i) => {
        if (bucket.value == null) {
          return (
            <div key={i} className="flex flex-1 items-end">
              <div className="h-1 w-full rounded-sm bg-muted" />
            </div>
          );
        }
        const pct = Math.max(8, Math.round(((bucket.value - domainMin) / span) * 100));
        return (
          <div key={i} className="flex flex-1 items-end">
            <div
              className="w-full rounded-sm bg-primary/70"
              style={{ height: `${pct}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}
