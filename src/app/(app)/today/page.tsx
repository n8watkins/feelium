import { CircleCheck, Plus, SmilePlus } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export default function TodayPage() {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <PageHeader title="Today" description={today} />
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
          <EmptyState
            icon={CircleCheck}
            title="No behaviors yet"
            description="Behavior tracking arrives in the tracking-setup phase. You'll record yes/no and numeric behaviors here, with unanswered entries kept distinct from No."
          />
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
            title="No check-ins today"
            description="Check-ins let you record how you feel at any time. Your most recent one will show here."
          />
        </section>
      </div>
    </>
  );
}
