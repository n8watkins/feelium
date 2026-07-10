import { ChevronDown, ChevronUp, Plus, SmilePlus } from "lucide-react";
import Link from "next/link";

import { ArchiveButton } from "@/components/tracking/archive-button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  outcomeDirectionLabel,
  outcomeInputTypeLabel,
} from "@/config/tracking";
import { listOutcomeMetrics } from "@/server/data";
import {
  archiveOutcomeAction,
  moveOutcomeAction,
  reactivateOutcomeAction,
} from "./actions";

export const metadata = { title: "Outcomes" };

export default async function OutcomesPage() {
  const all = await listOutcomeMetrics();
  const active = all.filter((o) => o.isActive);
  const archived = all.filter((o) => !o.isActive);

  return (
    <>
      <PageHeader
        title="Outcomes"
        description="Feelings and states you want to check in on."
        action={
          <Button asChild size="sm">
            <Link href="/settings/outcomes/new">
              <Plus className="size-4" aria-hidden="true" />
              Add
            </Link>
          </Button>
        }
      />

      <div className="space-y-6 px-4 pt-2 md:px-8">
        {active.length === 0 && archived.length === 0 ? (
          <EmptyState
            icon={SmilePlus}
            title="No outcomes yet"
            description="Add an outcome to check in on how you feel - a 1-5 rating, yes/no, or a number."
          />
        ) : null}

        {active.length > 0 ? (
          <ul className="space-y-2">
            {active.map((outcome, index) => (
              <li key={outcome.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="font-medium">{outcome.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary">
                        {outcomeInputTypeLabel(outcome.inputType)}
                      </Badge>
                      {outcome.desiredDirection ? (
                        <Badge variant="outline">
                          {outcomeDirectionLabel(outcome.desiredDirection)}
                        </Badge>
                      ) : null}
                      {outcome.unit ? (
                        <Badge variant="outline">{outcome.unit}</Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <form action={moveOutcomeAction}>
                      <input type="hidden" name="id" value={outcome.id} />
                      <input type="hidden" name="direction" value="up" />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${outcome.name} up`}
                        disabled={index === 0}
                      >
                        <ChevronUp className="size-4" aria-hidden="true" />
                      </Button>
                    </form>
                    <form action={moveOutcomeAction}>
                      <input type="hidden" name="id" value={outcome.id} />
                      <input type="hidden" name="direction" value="down" />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${outcome.name} down`}
                        disabled={index === active.length - 1}
                      >
                        <ChevronDown className="size-4" aria-hidden="true" />
                      </Button>
                    </form>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/settings/outcomes/${outcome.id}`}>Edit</Link>
                  </Button>
                  <ArchiveButton
                    id={outcome.id}
                    name={outcome.name}
                    action={archiveOutcomeAction}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {archived.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Archived</h2>
            <ul className="space-y-2">
              {archived.map((outcome) => (
                <li
                  key={outcome.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border p-3"
                >
                  <span className="text-sm text-muted-foreground">
                    {outcome.name}
                  </span>
                  <form action={reactivateOutcomeAction}>
                    <input type="hidden" name="id" value={outcome.id} />
                    <Button type="submit" variant="outline" size="sm">
                      Reactivate
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
