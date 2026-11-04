import { BarChart3 } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { DEFAULT_RANGE, isTimeRange, rangeLabel } from "@/lib/analytics";
import { addDaysISO, parseISODate } from "@/lib/date";
import { getInsights } from "@/server/data";
import { DayGrid } from "./_components/day-grid";
import { FindingCard, ProgressRow } from "./_components/finding-card";
import { FrequencyStrip } from "./_components/frequency-strip";
import { RangeTabs } from "./range-tabs";

export const metadata = { title: "Insights" };

function shortDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
}

/**
 * Insights, led by what stands out: comparisons that have enough data, written as
 * sentences. Then each feeling day by day, and how often each behavior happened. Plain
 * patterns in what you recorded, never medical advice. Wide (64rem) on desktop.
 */
export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const range = isTimeRange(rangeParam) ? rangeParam : DEFAULT_RANGE;
  const data = await getInsights(range);

  const ready = data.comparisons.filter((c) => c.eligible);
  // Progress only where there is genuine partial data, closest first, at most six.
  const pending = data.comparisons
    .filter((c) => !c.eligible && (c.progress.groupAHave > 0 || c.progress.groupBHave > 0))
    .sort(
      (a, b) =>
        b.progress.groupAHave + b.progress.groupBHave - (a.progress.groupAHave + a.progress.groupBHave),
    )
    .slice(0, 6);
  const end = data.windowStartISO ? addDaysISO(data.windowStartISO, data.windowDays - 1) : null;
  const eyebrow =
    data.windowStartISO && end ? `${shortDate(data.windowStartISO)} to ${shortDate(end)}` : rangeLabel(range);

  return (
    <div data-wide>
      <PageHeader eyebrow={eyebrow} title="Insights" action={<RangeTabs active={range} />} />
      <div className="grid gap-12 px-4 md:px-8">
        {!data.hasAnyData ? (
          <EmptyState
            icon={BarChart3}
            title="Not enough data yet"
            description={`Nothing was recorded in the ${rangeLabel(range).toLowerCase()}. Insights appear here once you record behaviors and check-ins.`}
          />
        ) : (
          <>
            <Section id="stands-out" title="What stands out">
              {ready.length > 0 ? (
                <>
                  {/* The strongest four (comparisons come sorted by the size of the difference). */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    {ready.slice(0, 4).map((c) => (
                      <FindingCard key={`${c.behavior.id}:${c.outcome.id}`} comparison={c} />
                    ))}
                  </div>
                  {ready.length > 4 ? (
                    <details className="group mt-4">
                      <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                        <span className="group-open:hidden">Show {ready.length - 4} more</span>
                        <span className="hidden group-open:inline">Show fewer</span>
                      </summary>
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        {ready.slice(4).map((c) => (
                          <FindingCard key={`${c.behavior.id}:${c.outcome.id}`} comparison={c} />
                        ))}
                      </div>
                    </details>
                  ) : null}
                </>
              ) : (
                <p className="rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  Nothing to compare yet. A comparison needs at least 5 days when a behavior happened
                  and 5 days when it didn&apos;t, each with a feeling recorded. Keep going and they&apos;ll
                  show up here.
                </p>
              )}
              {pending.length > 0 ? (
                <div className="mt-6">
                  <h3 className="mb-1 text-sm font-medium">Getting closer</h3>
                  <ul className="divide-y divide-border">
                    {pending.map((c) => (
                      <ProgressRow key={`${c.behavior.id}:${c.outcome.id}`} comparison={c} />
                    ))}
                  </ul>
                </div>
              ) : null}
            </Section>

            <>
              {data.outcomes.length > 0 ? (
                <Section id="day-by-day" title="How you felt, day by day">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {data.outcomes.map((o) => (
                      <DayGrid key={o.outcome.id} stats={o} />
                    ))}
                  </div>
                </Section>
              ) : null}
              {data.behaviors.length > 0 ? (
                <Section id="how-often" title="How often you did each">
                  <ul className="divide-y divide-border rounded-3xl border border-border px-5">
                    {data.behaviors.map((b) => (
                      <FrequencyStrip key={b.behavior.id} stats={b} />
                    ))}
                  </ul>
                </Section>
              ) : null}
            </>
            <p className="text-xs text-muted-foreground">
              Patterns in what you recorded, not medical advice.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
