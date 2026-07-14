import { CalendarDays, ChevronRight } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  DEFAULT_TIME_ZONE,
  formatDayFull,
  relativeDayLabel,
  startOfWeekISO,
} from "@/lib/date";
import { isISODate } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { getCurrentProfile, listHistoryDays, type HistoryDay } from "@/server/data";

export const metadata = { title: "History" };

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string | string[] }>;
}) {
  const rawBefore = (await searchParams).before;
  const before = typeof rawBefore === "string" && isISODate(rawBefore) ? rawBefore : undefined;
  const [history, profile] = await Promise.all([listHistoryDays(before), getCurrentProfile()]);
  const { days, nextCursor } = history;
  const timeZone = profile?.timezone ?? DEFAULT_TIME_ZONE;
  const weeks = groupByWeek(days, profile?.weekStartsOn ?? 1);

  return (
    <>
      <PageHeader
        title="History"
        description="Look back at any day you recorded. Days you skipped are just gaps in the data."
      />
      <div className="px-4 pb-6 pt-2 md:px-8">
        {days.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No history yet"
            description="Once you start recording, your days appear here in reverse chronological order - behaviors, check-ins, tags, and notes, all editable."
          />
        ) : (
          <div className="space-y-6">
            {weeks.map((week) => (
              <section key={week.start} aria-labelledby={`week-${week.start}`}>
                <h2
                  id={`week-${week.start}`}
                  className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Week of {formatDayFull(week.start)}
                </h2>
                <ul className="space-y-3">
                  {week.days.map((day) => (
                    <li key={day.date}>
                      <HistoryDayCard day={day} timeZone={timeZone} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        {nextCursor ? (
          <div className="mt-6 flex justify-center">
            <Link
              href={`/history?before=${encodeURIComponent(nextCursor)}`}
              className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
            >
              Older days
            </Link>
          </div>
        ) : null}
      </div>
    </>
  );
}

function groupByWeek(days: HistoryDay[], weekStartsOn: number) {
  const groups: Array<{ start: string; days: HistoryDay[] }> = [];
  for (const day of days) {
    const start = startOfWeekISO(day.date, weekStartsOn);
    const current = groups.at(-1);
    if (current?.start === start) current.days.push(day);
    else groups.push({ start, days: [day] });
  }
  return groups;
}

function countsLine(day: HistoryDay): string {
  const parts: string[] = [];
  if (day.behaviorCount > 0) {
    parts.push(
      `${day.behaviorCount} behavior${day.behaviorCount === 1 ? "" : "s"}`,
    );
  }
  if (day.checkInCount > 0) {
    parts.push(
      `${day.checkInCount} check-in${day.checkInCount === 1 ? "" : "s"}`,
    );
  }
  return parts.join(" · ");
}

function HistoryDayCard({ day, timeZone }: { day: HistoryDay; timeZone: string }) {
  const relative = relativeDayLabel(day.date, timeZone);

  return (
    <Link
      href={`/history/${day.date}`}
      className="block rounded-lg border border-border p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{formatDayFull(day.date)}</span>
            {relative ? (
              <Badge variant="secondary" className="font-normal">
                {relative}
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {countsLine(day)}
          </p>
        </div>
        <ChevronRight
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </div>

      {day.outcomes.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {day.outcomes.map((outcome) => (
            <Badge
              key={outcome.outcomeMetricId}
              variant="secondary"
              className="gap-1 font-normal tabular-nums"
            >
              <span className="text-muted-foreground">{outcome.name}</span>
              <span className="font-medium">{outcome.value}</span>
            </Badge>
          ))}
        </div>
      ) : null}

      {day.tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {day.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="font-normal">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}

      {day.notePreview ? (
        <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
          {day.notePreview}
        </p>
      ) : null}
    </Link>
  );
}
