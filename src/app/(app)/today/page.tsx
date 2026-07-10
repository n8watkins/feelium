import { CircleCheck, Plus, SmilePlus } from "lucide-react";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  countCheckInsForDate,
  getTrackingCounts,
  listActiveBehaviors,
} from "@/server/data";

export default async function TodayPage() {
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

  // Session-scoped reads through the central data-access module.
  const [behaviors, checkInsToday] = await Promise.all([
    listActiveBehaviors(),
    countCheckInsForDate(localDate),
  ]);

  return (
    <>
      <PageHeader title="Today" description={heading} />
      <div className="space-y-6 px-4 pt-2 md:px-8">
        <Button size="lg" className="h-14 w-full text-base">
          <Plus className="size-5" aria-hidden="true" />
          Check in now
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
              title="No behaviors yet"
              description="Behavior tracking arrives in the tracking-setup phase. You'll record yes/no and numeric behaviors here, with unanswered entries kept distinct from No."
            />
          ) : (
            <ul className="space-y-2">
              {behaviors.map((behavior) => (
                <li
                  key={behavior.id}
                  className="rounded-lg border border-border px-4 py-3 text-sm font-medium"
                >
                  {behavior.name}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3" aria-labelledby="latest-heading">
          <h2
            id="latest-heading"
            className="text-sm font-medium text-muted-foreground"
          >
            Latest check-in
          </h2>
          <EmptyState
            icon={SmilePlus}
            title={
              checkInsToday === 0
                ? "No check-ins today"
                : `${checkInsToday} check-in${checkInsToday === 1 ? "" : "s"} today`
            }
            description="Check-ins let you record how you feel at any time. Your most recent one will show here."
          />
        </section>
      </div>
    </>
  );
}
