import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import Link from "next/link";

import { ArchiveButton } from "@/components/tracking/archive-button";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { CircleCheck } from "lucide-react";
import {
  behaviorDirectionLabel,
  behaviorInputTypeLabel,
} from "@/config/tracking";
import { listBehaviors } from "@/server/data";
import {
  archiveBehaviorAction,
  moveBehaviorAction,
  reactivateBehaviorAction,
} from "./actions";

export const metadata = { title: "Behaviors" };

export default async function BehaviorsPage() {
  const all = await listBehaviors();
  const active = all.filter((b) => b.isActive);
  const archived = all.filter((b) => !b.isActive);

  return (
    <>
      <PageHeader
        title="Behaviors"
        description="Actions and consumption you want to observe."
        action={
          <Button asChild size="sm">
            <Link href="/settings/behaviors/new">
              <Plus className="size-4" aria-hidden="true" />
              Add
            </Link>
          </Button>
        }
      />

      <div className="space-y-6 px-4 pt-2 md:px-8">
        {active.length === 0 && archived.length === 0 ? (
          <EmptyState
            icon={CircleCheck}
            title="No behaviors yet"
            description="Add a behavior to start tracking what you do - yes/no or a number with a unit."
          />
        ) : null}

        {active.length > 0 ? (
          <ul className="space-y-2">
            {active.map((behavior, index) => (
              <li
                key={behavior.id}
                className="rounded-lg border border-border p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="font-medium">{behavior.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary">
                        {behaviorInputTypeLabel(behavior.inputType)}
                      </Badge>
                      <Badge variant="outline">
                        {behaviorDirectionLabel(behavior.desiredDirection)}
                      </Badge>
                      {behavior.unit ? (
                        <Badge variant="outline">{behavior.unit}</Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <form action={moveBehaviorAction}>
                      <input type="hidden" name="id" value={behavior.id} />
                      <input type="hidden" name="direction" value="up" />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${behavior.name} up`}
                        disabled={index === 0}
                      >
                        <ChevronUp className="size-4" aria-hidden="true" />
                      </Button>
                    </form>
                    <form action={moveBehaviorAction}>
                      <input type="hidden" name="id" value={behavior.id} />
                      <input type="hidden" name="direction" value="down" />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${behavior.name} down`}
                        disabled={index === active.length - 1}
                      >
                        <ChevronDown className="size-4" aria-hidden="true" />
                      </Button>
                    </form>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/settings/behaviors/${behavior.id}`}>Edit</Link>
                  </Button>
                  <ArchiveButton
                    id={behavior.id}
                    name={behavior.name}
                    action={archiveBehaviorAction}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {archived.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Archived
            </h2>
            <ul className="space-y-2">
              {archived.map((behavior) => (
                <li
                  key={behavior.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border p-3"
                >
                  <span className="text-sm text-muted-foreground">
                    {behavior.name}
                  </span>
                  <form action={reactivateBehaviorAction}>
                    <input type="hidden" name="id" value={behavior.id} />
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
