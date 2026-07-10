import { ChevronRight, CircleCheck, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { BehaviorLogRow } from "@/components/tracking/behavior-log-row";
import { SavedCheckInToast } from "@/components/tracking/saved-check-in-toast";
import { Button } from "@/components/ui/button";
import { formatOutcomeValue } from "@/config/tracking";
import {
  countCheckInsForDate,
  getEntriesForDate,
  getLatestCheckIn,
  getTrackingCounts,
  listActiveBehaviors,
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

  const now = new Date();
  const heading = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const localDate = now.toLocaleDateString("en-CA"); // YYYY-MM-DD

  const [behaviors, entries, checkInsToday, latest] = await Promise.all([
    listActiveBehaviors(),
    getEntriesForDate(localDate),
    countCheckInsForDate(localDate),
    getLatestCheckIn(),
  ]);

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
              <ul className="space-y-2">
                {behaviors.map((behavior) => {
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
                    />
                  );
                })}
              </ul>
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
              className="block rounded-lg border border-border p-4 transition-colors hover:bg-accent"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">
                  {latest.checkIn.occurredAt.toLocaleTimeString(undefined, {
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
