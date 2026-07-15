import { ChevronRight, CircleCheck, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { BehaviorLogRow } from "@/components/tracking/behavior-log-row";
import { CategoryBadge } from "@/components/tracking/category-badge";
import { SavedCheckInToast } from "@/components/tracking/saved-check-in-toast";
import { Button } from "@/components/ui/button";
import { BEHAVIOR_CATEGORY_COLOR_STYLES } from "@/config/behavior-categories";
import { formatOutcomeValue } from "@/config/tracking";
import { dateISOInTimeZone, DEFAULT_TIME_ZONE } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  countCheckInsForDate,
  getEntriesForDate,
  getLatestCheckIn,
  getCurrentProfile,
  getTrackingCounts,
  listActiveBehaviors,
  listBehaviorCategories,
} from "@/server/data";

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
  const heading = now.toLocaleDateString(undefined, {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const localDate = dateISOInTimeZone(now, timeZone);

  const [behaviors, categories, entries, checkInsToday, latest] =
    await Promise.all([
      listActiveBehaviors(),
      listBehaviorCategories(),
      getEntriesForDate(localDate),
      countCheckInsForDate(localDate),
      getLatestCheckIn(),
    ]);
  const behaviorGroups: {
    category: (typeof categories)[number] | null;
    behaviors: typeof behaviors;
  }[] = categories
    .map((category) => ({
      category,
      behaviors: behaviors.filter(
        (behavior) => behavior.categoryId === category.id,
      ),
    }))
    .filter((group) => group.behaviors.length > 0);
  const uncategorized = behaviors.filter(
    (behavior) =>
      !behavior.categoryId ||
      !categories.some((category) => category.id === behavior.categoryId),
  );
  if (uncategorized.length > 0) {
    behaviorGroups.push({ category: null, behaviors: uncategorized });
  }

  return (
    <>
      {checkin === "saved" ? <SavedCheckInToast /> : null}
      <PageHeader title="Today" description={heading} />
      <div className="space-y-6 px-4 pt-2 md:px-8">
        <Button asChild size="lg" className="h-14 w-full text-base">
          <Link href="/checkin/new">
            <Plus className="size-5" aria-hidden="true" />
            Check in now
          </Link>
        </Button>

        <section className="space-y-3" aria-labelledby="behaviors-heading">
          <h2
            id="behaviors-heading"
            className="text-sm font-medium text-muted-foreground"
          >
            Today&apos;s behaviors
          </h2>
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
            <>
              <div className="space-y-5">
                {behaviorGroups.map((group) => (
                  <section
                    key={group.category?.id ?? "uncategorized"}
                    aria-labelledby={`behavior-group-${group.category?.id ?? "uncategorized"}`}
                    className={cn(
                      "space-y-2 border-l-2 pl-3",
                      group.category
                        ? BEHAVIOR_CATEGORY_COLOR_STYLES[group.category.color]
                            .accent
                        : "border-border",
                    )}
                  >
                    <h3
                      id={`behavior-group-${group.category?.id ?? "uncategorized"}`}
                    >
                      {group.category ? (
                        <CategoryBadge
                          name={group.category.name}
                          color={group.category.color}
                        />
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground">
                          Uncategorized
                        </span>
                      )}
                    </h3>
                    <ul className="space-y-2">
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
                ))}
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link href="/settings/behaviors/new?from=/today">
                  <Plus className="size-4" aria-hidden="true" />
                  Add behavior
                </Link>
              </Button>
            </>
          )}
        </section>

        <section className="space-y-3" aria-labelledby="latest-heading">
          <h2
            id="latest-heading"
            className="text-sm font-medium text-muted-foreground"
          >
            Latest check-in
          </h2>
          {latest ? (
            <Link
              href={`/checkin/${latest.checkIn.id}`}
              className="block rounded-lg border border-border p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  {latest.checkIn.occurredAt.toLocaleTimeString(undefined, {
                    timeZone,
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {" · "}
                  {checkInsToday} today
                </span>
                <ChevronRight
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
              {latest.values.length > 0 ? (
                <dl className="mt-3 space-y-1">
                  {latest.values.map((value) => (
                    <div
                      key={value.outcomeMetricId}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <dt className="text-muted-foreground">{value.name}</dt>
                      <dd className="font-medium tabular-nums">
                        {formatOutcomeValue(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  {latest.checkIn.note ?? "Tap to view"}
                </p>
              )}
            </Link>
          ) : (
            <EmptyState
              icon={CircleCheck}
              title="No check-ins yet"
              description="Tap Check in now to record how you feel. Your most recent one will show here."
            />
          )}
        </section>
      </div>
    </>
  );
}
