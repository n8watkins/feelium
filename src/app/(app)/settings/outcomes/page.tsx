import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { SettingsGroup } from "@/components/settings/settings-list";
import { FeelingMenu } from "@/components/tracking/feeling-menu";
import { Button } from "@/components/ui/button";
import { outcomeDirectionLabel, outcomeInputTypeLabel } from "@/config/tracking";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { countAnswersByOutcome, listOutcomeMetrics } from "@/server/data";
import {
  archiveOutcomeAction,
  deleteOutcomeAction,
  moveOutcomeAction,
  reactivateOutcomeAction,
} from "./actions";

export const metadata = { title: "Feelings" };

type Feeling = Awaited<ReturnType<typeof listOutcomeMetrics>>[number];

/** "1-5 rating · Higher is better", each part kept whole when the line wraps. */
function Detail({ feeling }: { feeling: Feeling }) {
  const parts = [
    feeling.unit
      ? `${outcomeInputTypeLabel(feeling.inputType)} in ${feeling.unit}`
      : outcomeInputTypeLabel(feeling.inputType),
    feeling.desiredDirection ? outcomeDirectionLabel(feeling.desiredDirection) : null,
  ].filter((part): part is string => Boolean(part));
  return (
    <span className="block text-sm text-muted-foreground">
      {parts.map((part, index) => (
        <span key={part} className="whitespace-nowrap">
          {index > 0 ? " · " : null}
          {part}
        </span>
      ))}
    </span>
  );
}

/**
 * Feelings: what a check-in asks about. Reorder, rename, archive (off the check-in, kept
 * in History and Insights) or delete (gone, with past answers kept unless erased).
 */
export default async function FeelingsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const backHref = from ? safeRedirectPath(from, "/settings") : "/settings";
  const backLabel = backHref.startsWith("/today") ? "Today" : "Settings";

  const [all, answers] = await Promise.all([listOutcomeMetrics(), countAnswersByOutcome()]);
  const active = all.filter((feeling) => feeling.isActive);
  const archived = all.filter((feeling) => !feeling.isActive);
  const menuActions = {
    archiveAction: archiveOutcomeAction,
    reactivateAction: reactivateOutcomeAction,
    deleteAction: deleteOutcomeAction,
  };

  return (
    <>
      <PageHeader
        title="Feelings"
        description="What each check-in asks about, in this order. Skip any of them when you check in."
        backHref={backHref}
        backLabel={backLabel}
      />
      <div className="grid gap-10 px-4 pt-2 pb-6 md:px-8">
        <Section id="on-check-in" title="On your check-in">
          <SettingsGroup>
            {active.map((feeling, index) => (
              <li key={feeling.id} className="flex min-h-16 items-center gap-1 py-1.5 pr-1.5 pl-5 md:gap-2 md:py-2 md:pr-2">
                <Link
                  href={`/settings/outcomes/${feeling.id}`}
                  className="min-w-0 flex-1 rounded-md py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="block truncate text-[15px] font-medium">{feeling.name}</span>
                  <Detail feeling={feeling} />
                </Link>
                <div className="flex shrink-0 items-center">
                  <form action={moveOutcomeAction}>
                    <input type="hidden" name="id" value={feeling.id} />
                    <input type="hidden" name="direction" value="up" />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${feeling.name} up`}
                      disabled={index === 0}
                      className="size-11 rounded-full text-muted-foreground hover:text-foreground md:size-9"
                    >
                      <ChevronUp className="size-4" aria-hidden="true" />
                    </Button>
                  </form>
                  <form action={moveOutcomeAction}>
                    <input type="hidden" name="id" value={feeling.id} />
                    <input type="hidden" name="direction" value="down" />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${feeling.name} down`}
                      disabled={index === active.length - 1}
                      className="size-11 rounded-full text-muted-foreground hover:text-foreground md:size-9"
                    >
                      <ChevronDown className="size-4" aria-hidden="true" />
                    </Button>
                  </form>
                  <FeelingMenu
                    id={feeling.id}
                    name={feeling.name}
                    answers={answers.get(feeling.id) ?? 0}
                    isActive
                    {...menuActions}
                  />
                </div>
              </li>
            ))}
            {active.length === 0 ? (
              <li className="px-5 py-4 text-sm text-muted-foreground">
                Your check-in asks about nothing yet. Add a feeling, or restore an archived one.
              </li>
            ) : null}
            <li>
              <Link
                href="/settings/outcomes/new"
                className="flex min-h-14 items-center gap-2 px-5 text-[15px] font-medium transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <Plus className="size-4" aria-hidden="true" />
                Add a feeling
              </Link>
            </li>
          </SettingsGroup>
        </Section>

        {archived.length > 0 ? (
          <Section id="archived" title="Archived" aside="Off the check-in, kept in Insights">
            <SettingsGroup>
              {archived.map((feeling) => (
                <li key={feeling.id} className="flex min-h-16 items-center gap-1 py-1.5 pr-1.5 pl-5 md:gap-2 md:py-2 md:pr-2">
                  <span className="min-w-0 flex-1 py-1">
                    <span className="block truncate text-[15px] font-medium text-muted-foreground">
                      {feeling.name}
                    </span>
                    <Detail feeling={feeling} />
                  </span>
                  <form action={reactivateOutcomeAction}>
                    <input type="hidden" name="id" value={feeling.id} />
                    <Button type="submit" variant="outline" size="sm" className="h-8 rounded-full px-3.5">
                      Restore
                    </Button>
                  </form>
                  <FeelingMenu
                    id={feeling.id}
                    name={feeling.name}
                    answers={answers.get(feeling.id) ?? 0}
                    isActive={false}
                    {...menuActions}
                  />
                </li>
              ))}
            </SettingsGroup>
          </Section>
        ) : null}
      </div>
    </>
  );
}
