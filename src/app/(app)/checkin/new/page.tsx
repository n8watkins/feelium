import { PageHeader } from "@/components/page-header";
import { BehaviorLogRow } from "@/components/tracking/behavior-log-row";
import { CheckInForm } from "@/components/tracking/check-in-form";
import { Separator } from "@/components/ui/separator";
import {
  getEntriesForDate,
  listActiveBehaviors,
  listActiveOutcomeMetrics,
  listTags,
} from "@/server/data";

export const metadata = { title: "New check-in" };

export default async function NewCheckInPage() {
  const localDate = new Date().toLocaleDateString("en-CA");
  const [outcomes, tags, behaviors, entries] = await Promise.all([
    listActiveOutcomeMetrics(),
    listTags(),
    listActiveBehaviors(),
    getEntriesForDate(localDate),
  ]);

  return (
    <>
      <PageHeader title="Check in" backHref="/today" backLabel="Today" />
      <div className="space-y-6 px-4 pb-6 pt-2 md:px-8">
        <CheckInForm
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

        {behaviors.length > 0 ? (
          <>
            <Separator />
            <section className="space-y-3" aria-labelledby="quick-behaviors">
              <h2
                id="quick-behaviors"
                className="text-sm font-medium text-muted-foreground"
              >
                Update today&apos;s behaviors{" "}
                <span className="font-normal">(optional)</span>
              </h2>
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
            </section>
          </>
        ) : null}
      </div>
    </>
  );
}
