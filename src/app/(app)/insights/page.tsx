import { BarChart3, GitCompareArrows } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { DEFAULT_RANGE, isTimeRange, rangeLabel } from "@/lib/analytics";
import { getInsights } from "@/server/data";
import { BehaviorCard } from "./_components/behavior-card";
import {
  ComparisonCard,
  ComparisonProgressCard,
} from "./_components/comparison-card";
import { OutcomeCard } from "./_components/outcome-card";
import { RangeTabs } from "./range-tabs";

export const metadata = { title: "Insights" };

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const range = isTimeRange(rangeParam) ? rangeParam : DEFAULT_RANGE;
  const data = await getInsights(range);

  const ready = data.comparisons.filter((c) => c.eligible);
  // Only surface progress cards that have genuine partial data, closest-first, capped so the
  // page never becomes a wall of empty "0 of 5" prompts (PRD: friendly, not overwhelming).
  const pending = data.comparisons
    .filter(
      (c) =>
        !c.eligible &&
        (c.progress.groupAHave > 0 || c.progress.groupBHave > 0),
    )
    .sort(
      (a, b) =>
        b.progress.groupAHave +
        b.progress.groupBHave -
        (a.progress.groupAHave + a.progress.groupBHave),
    )
    .slice(0, 6);

  return (
    <>
      <PageHeader
        title="Insights"
        description="Plain-language patterns based on your recorded data - never medical or causal claims."
      />
      <div className="space-y-8 px-4 pb-6 pt-2 md:px-8">
        <RangeTabs active={range} />

        {!data.hasAnyData ? (
          <EmptyState
            icon={BarChart3}
            title="Not enough data yet"
            description={`Nothing was recorded in the ${rangeLabel(
              range,
            ).toLowerCase()}. Insights appear here once you record behaviors and check-ins.`}
          />
        ) : (
          <>
            <Section
              id="comparisons"
              title="Comparisons"
              subtitle="How an outcome looked on days a behavior did or did not happen."
            >
              {ready.length > 0 ? (
                <div className="space-y-3">
                  {ready.map((c) => (
                    <ComparisonCard
                      key={`${c.behavior.id}:${c.outcome.id}`}
                      comparison={c}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={GitCompareArrows}
                  title="No comparisons ready yet"
                  description="A comparison needs at least 5 days when a behavior happened and 5 days when it did not, each with an outcome recorded. Keep recording and they'll appear."
                />
              )}

              {pending.length > 0 ? (
                <div className="space-y-3 pt-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Getting closer
                  </p>
                  {pending.map((c) => (
                    <ComparisonProgressCard
                      key={`${c.behavior.id}:${c.outcome.id}`}
                      comparison={c}
                    />
                  ))}
                </div>
              ) : null}
            </Section>

            {data.behaviors.length > 0 ? (
              <Section
                id="behaviors"
                title="Behaviors"
                subtitle="How often each behavior happened."
              >
                <div className="space-y-3">
                  {data.behaviors.map((b) => (
                    <BehaviorCard key={b.behavior.id} stats={b} />
                  ))}
                </div>
              </Section>
            ) : null}

            {data.outcomes.length > 0 ? (
              <Section
                id="outcomes"
                title="How you felt"
                subtitle="Trends in your recorded outcomes."
              >
                <div className="space-y-3">
                  {data.outcomes.map((o) => (
                    <OutcomeCard key={o.outcome.id} stats={o} />
                  ))}
                </div>
              </Section>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

function Section({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-3">
      <div className="space-y-0.5">
        <h2
          id={`${id}-heading`}
          className="text-lg font-semibold tracking-tight"
        >
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}
