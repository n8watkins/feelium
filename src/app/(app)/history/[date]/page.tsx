import { Archive, CalendarDays, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { BehaviorLogRow } from "@/components/tracking/behavior-log-row";
import { DeleteCheckInButton } from "@/components/tracking/delete-check-in-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatOutcomeValue } from "@/config/tracking";
import {
  DEFAULT_TIME_ZONE,
  formatDayFull,
  formatTime,
  relativeDayLabel,
} from "@/lib/date";
import { isISODate } from "@/lib/validation";
import {
  getDayDetail,
  getCurrentProfile,
  type DayBehavior,
  type DayCheckIn,
} from "@/server/data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  return { title: isISODate(date) ? formatDayFull(date) : "History" };
}

export default async function DayDetailPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!isISODate(date)) notFound();

  const [detail, profile] = await Promise.all([getDayDetail(date), getCurrentProfile()]);
  const timeZone = profile?.timezone ?? DEFAULT_TIME_ZONE;
  const relative = relativeDayLabel(date, timeZone);
  const hasAnyData =
    detail.checkIns.length > 0 ||
    detail.archivedBehaviors.length > 0 ||
    detail.activeBehaviors.some((b) => b.hasEntry);

  return (
    <>
      <PageHeader
        title={formatDayFull(date)}
        description={relative ?? undefined}
        backHref="/history"
        backLabel="History"
      />
      <div className="space-y-8 px-4 pb-6 pt-2 md:px-8">
        {!hasAnyData && detail.activeBehaviors.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nothing recorded this day"
            description="There's no data for this date. It won't appear in your history list."
          />
        ) : null}

        <section className="space-y-3" aria-labelledby="day-behaviors">
          <h2
            id="day-behaviors"
            className="text-sm font-medium text-muted-foreground"
          >
            Behaviors
          </h2>
          {detail.activeBehaviors.length > 0 ? (
            <ul className="space-y-2">
              {detail.activeBehaviors.map((item) => (
                <BehaviorLogRow
                  key={item.behavior.id}
                  behavior={{
                    id: item.behavior.id,
                    name: item.behavior.name,
                    inputType: item.behavior.inputType,
                    unit: item.behavior.unit,
                  }}
                  entryDate={date}
                  booleanValue={item.booleanValue}
                  numericValue={item.numericValue}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No active behaviors to record.
            </p>
          )}

          {detail.archivedBehaviors.length > 0 ? (
            <div className="space-y-2 pt-1">
              <p className="text-xs text-muted-foreground">
                Archived behaviors with data this day
              </p>
              <ul className="space-y-2">
                {detail.archivedBehaviors.map((item) => (
                  <ArchivedBehaviorRow key={item.behavior.id} item={item} />
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="space-y-3" aria-labelledby="day-checkins">
          <h2
            id="day-checkins"
            className="text-sm font-medium text-muted-foreground"
          >
            Check-ins
          </h2>
          {detail.checkIns.length > 0 ? (
            <ul className="space-y-3">
              {detail.checkIns.map((checkIn) => (
                <li key={checkIn.id}>
                  <CheckInCard checkIn={checkIn} date={date} timeZone={timeZone} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No check-ins recorded this day.
            </p>
          )}
        </section>
      </div>
    </>
  );
}

function formatBehaviorValue(item: DayBehavior): string {
  if (item.behavior.inputType === "boolean") {
    if (item.booleanValue == null) return "Not recorded";
    return item.booleanValue ? "Yes" : "No";
  }
  if (item.numericValue == null) return "Not recorded";
  return `${item.numericValue}${item.behavior.unit ? ` ${item.behavior.unit}` : ""}`;
}

function ArchivedBehaviorRow({ item }: { item: DayBehavior }) {
  return (
    <li className="rounded-lg border border-dashed border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium">
          {item.behavior.name}
          <Badge variant="outline" className="gap-1 font-normal">
            <Archive className="size-3" aria-hidden="true" />
            Archived
          </Badge>
        </span>
        <span className="text-sm tabular-nums">{formatBehaviorValue(item)}</span>
      </div>
    </li>
  );
}

function CheckInCard({
  checkIn,
  date,
  timeZone,
}: {
  checkIn: DayCheckIn;
  date: string;
  timeZone: string;
}) {
  const time = formatTime(checkIn.occurredAt, timeZone);

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium tabular-nums">{time}</span>
      </div>

      {checkIn.values.length > 0 ? (
        <dl className="mt-3 space-y-1.5">
          {checkIn.values.map((value) => (
            <div
              key={value.outcomeMetricId}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                {value.name}
                {!value.isActive ? (
                  <Badge variant="outline" className="gap-1 font-normal">
                    <Archive className="size-3" aria-hidden="true" />
                    Archived
                  </Badge>
                ) : null}
              </dt>
              <dd className="font-medium tabular-nums">
                {formatOutcomeValue(value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          No outcome values recorded.
        </p>
      )}

      {checkIn.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {checkIn.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="font-normal">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}

      {checkIn.note ? (
        <p className="mt-3 text-sm whitespace-pre-wrap">{checkIn.note}</p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <Button asChild variant="outline" className="h-10 flex-1">
          <Link href={`/checkin/${checkIn.id}?from=/history/${date}`}>
            <Pencil className="size-4" aria-hidden="true" />
            Edit
          </Link>
        </Button>
        <DeleteCheckInButton
          checkInId={checkIn.id}
          date={date}
          label={`The ${time} check-in`}
        />
      </div>
    </div>
  );
}
