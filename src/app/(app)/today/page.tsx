import { CircleCheck, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { BehaviorLogRow } from "@/components/tracking/behavior-log-row";
import { CategoryBadge } from "@/components/tracking/category-badge";
import { CheckInForm } from "@/components/tracking/check-in-form";
import { CheckInSaved } from "@/components/tracking/check-in-saved";
import { Button } from "@/components/ui/button";
import { formatOutcomeValue } from "@/config/tracking";
import { dateISOInTimeZone, DEFAULT_TIME_ZONE, formatTime } from "@/lib/date";
import {
  getCurrentProfile,
  getDayDetail,
  getEntriesForDate,
  getTrackingCounts,
  listActiveBehaviors,
  listActiveOutcomeMetrics,
  listBehaviorCategories,
  listTags,
} from "@/server/data";

/**
 * Today: how you feel right now (the check-in), what you did today (behaviors, saved as
 * you tap), and today's earlier check-ins. A reminder opens here at #checkin.
 */
export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ checkin?: string }>;
}) {
  const { checkin } = await searchParams;
  // First-run: a blank account is sent to onboarding rather than an empty system (PRD 11.2).
  const counts = await getTrackingCounts();
  if (counts.behaviors === 0 && counts.outcomes === 0) {
    redirect("/onboarding");
  }

  const profile = await getCurrentProfile();
  const timeZone = profile?.timezone ?? DEFAULT_TIME_ZONE;
  const now = new Date();
  const weekday = now.toLocaleDateString("en-US", { timeZone, weekday: "long" });
  const monthDay = now.toLocaleDateString("en-US", { timeZone, month: "long", day: "numeric" });
  const localDate = dateISOInTimeZone(now, timeZone);

  const [behaviors, categories, entries, outcomes, tags, day] = await Promise.all([
    listActiveBehaviors(),
    listBehaviorCategories(),
    getEntriesForDate(localDate),
    listActiveOutcomeMetrics(),
    listTags(),
    getDayDetail(localDate),
  ]);

  const groups = categories
    .map((category) => ({
      category,
      behaviors: behaviors.filter((behavior) => behavior.categoryId === category.id),
    }))
    .filter((group) => group.behaviors.length > 0) as {
    category: (typeof categories)[number] | null;
    behaviors: typeof behaviors;
  }[];
  const uncategorized = behaviors.filter(
    (behavior) => !behavior.categoryId || !categories.some((c) => c.id === behavior.categoryId),
  );
  if (uncategorized.length > 0) groups.push({ category: null, behaviors: uncategorized });
  const hasCategories = groups.some((group) => group.category);
  const checkIns = [...day.checkIns].reverse(); // newest first

  return (
    <>
      <PageHeader
        eyebrow={monthDay}
        title={weekday}
        action={
          <p className="text-right text-sm leading-tight text-muted-foreground">
            <span className="block text-2xl font-semibold text-foreground tabular-nums">
              {checkIns.length}
            </span>
            {checkIns.length === 1 ? "check-in today" : "check-ins today"}
          </p>
        }
      />
      {/* Wide on laptops: the check-in on the left, what you did and earlier on the right. */}
      <div data-wide className="grid items-start gap-12 px-4 md:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10">
        <Section
          id="checkin"
          title="How do you feel right now?"
          aside={outcomes.length > 0 ? "Tap again to skip" : undefined}
        >
          {/* Keyed by today's count, so a saved check-in leaves a fresh, empty form. */}
          <CheckInForm
            key={checkIns.length}
            localDate={localDate}
            outcomes={outcomes.map((o) => ({
              id: o.id,
              name: o.name,
              inputType: o.inputType,
              unit: o.unit,
              desiredDirection: o.desiredDirection,
            }))}
            tags={tags.map((t) => ({ id: t.id, name: t.name }))}
          />
          <CheckInSaved justSaved={checkin === "saved"} />
        </Section>
        <div className="grid gap-12">

        <Section
          id="behaviors"
          title="What you did today"
          aside={behaviors.length > 0 ? "Saved as you tap" : undefined}
        >
          {behaviors.length === 0 ? (
            <EmptyState
              icon={CircleCheck}
              title="No active behaviors"
              description="Add a behavior to start recording what you do each day."
              action={
                <Button asChild size="sm">
                  <Link href="/settings/behaviors/new?from=/today">
                    <Plus className="size-4" aria-hidden="true" />
                    Add behavior
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-6">
              {groups.map((group) => {
                const groupId = `behavior-group-${group.category?.id ?? "uncategorized"}`;
                return (
                  <section key={groupId} aria-labelledby={groupId} className="space-y-2">
                    <h3 id={groupId} className={hasCategories ? undefined : "sr-only"}>
                      {group.category ? (
                        <CategoryBadge name={group.category.name} color={group.category.color} />
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground">Uncategorized</span>
                      )}
                    </h3>
                    <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-1">
                      {group.behaviors.map((behavior) => {
                        const entry = entries.get(behavior.id);
                        return (
                          <BehaviorLogRow
                            key={behavior.id}
                            behavior={{
                              id: behavior.id,
                              name: behavior.name,
                              inputType: behavior.inputType,
                              unit: behavior.unit,
                            }}
                            entryDate={localDate}
                            booleanValue={entry?.booleanValue ?? null}
                            numericValue={entry?.numericValue ?? null}
                            editHref={`/settings/behaviors/${behavior.id}?from=/today`}
                          />
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
              <Link
                href="/settings/behaviors/new?from=/today"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="size-4" aria-hidden="true" />
                Add behavior
              </Link>
            </div>
          )}
        </Section>

        <Section
          id="earlier"
          title="Earlier today"
          aside={
            <Link href="/history" className="font-medium text-foreground underline-offset-4 hover:underline">
              All days
            </Link>
          }
        >
          {checkIns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No check-ins yet today. The first one shows up here.
            </p>
          ) : (
            <ol className="relative ml-1.5 border-l border-border">
              {checkIns.map((checkIn) => {
                const values = checkIn.values
                  .filter((v) => v.rating != null || v.boolean != null || v.numeric != null)
                  .map((v) => `${v.name} ${formatOutcomeValue(v)}`)
                  .join(" · ");
                return (
                  <li key={checkIn.id} className="relative pb-6 pl-6 last:pb-0">
                    <span className="absolute top-1.5 -left-[5px] size-[9px] rounded-full bg-foreground" aria-hidden="true" />
                    <Link
                      href={`/checkin/${checkIn.id}?from=/today`}
                      className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="text-sm font-semibold tabular-nums group-hover:underline">
                        {formatTime(checkIn.occurredAt, timeZone)}
                      </span>
                      {values ? <span className="block text-sm text-muted-foreground">{values}</span> : null}
                      {checkIn.tags.length > 0 ? (
                        <span className="block text-xs text-muted-foreground">{checkIn.tags.join(", ")}</span>
                      ) : null}
                      {checkIn.note ? <span className="mt-1 block text-sm">{checkIn.note}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </Section>
        </div>
      </div>
    </>
  );
}
