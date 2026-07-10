import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, type OutcomeStats } from "@/lib/analytics";
import { ArchivedBadge } from "./archived-badge";
import { Stat } from "./stat";
import { TrendChart } from "./trend-chart";

/** Outcome analytics card (PRD 16.3): average / range / check-ins over daily averages. */
export function OutcomeCard({ stats }: { stats: OutcomeStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {stats.outcome.name}
          {!stats.outcome.isActive ? <ArchivedBadge /> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats.kind === "boolean" ? (
          <BooleanBody stats={stats} />
        ) : (
          <NumericBody stats={stats} />
        )}
      </CardContent>
    </Card>
  );
}

function dayWord(n: number): string {
  return n === 1 ? "day" : "days";
}

function NumericBody({ stats }: { stats: OutcomeStats }) {
  const unit = stats.kind === "rating" ? " / 5" : stats.unit ? ` ${stats.unit}` : "";
  const fmt = (n: number) => `${formatNumber(n)}${unit}`;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Average"
          value={stats.average != null ? fmt(stats.average) : "—"}
        />
        <Stat label="Lowest" value={stats.lowest != null ? fmt(stats.lowest) : "—"} />
        <Stat label="Highest" value={stats.highest != null ? fmt(stats.highest) : "—"} />
        <Stat
          label="Check-ins"
          value={String(stats.checkInCount)}
          hint={`${stats.recordedDays} ${dayWord(stats.recordedDays)}`}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Based on each day&rsquo;s average
        {stats.multiCheckInDays > 0 ? (
          <>
            {" "}
            - {stats.multiCheckInDays} {dayWord(stats.multiCheckInDays)} had more than
            one check-in
          </>
        ) : null}
        .
      </p>

      <TrendChart
        trend={stats.trend}
        subject="value"
        formatValue={fmt}
        label={`${stats.outcome.name} over time`}
      />
    </>
  );
}

function BooleanBody({ stats }: { stats: OutcomeStats }) {
  return (
    <>
      <p className="text-sm leading-relaxed">
        Recorded <strong>Yes</strong> on {stats.yesDays} of {stats.recordedDays}{" "}
        {dayWord(stats.recordedDays)}, <strong>No</strong> on {stats.noDays}.
      </p>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Yes days" value={String(stats.yesDays)} />
        <Stat label="No days" value={String(stats.noDays)} />
        <Stat label="Check-ins" value={String(stats.checkInCount)} />
      </div>

      <p className="text-xs text-muted-foreground">
        Shows the latest value recorded on each day.
      </p>

      <TrendChart
        trend={stats.trend}
        subject="occurrence"
        formatValue={(n) => `${Math.round(n * 100)}% of days`}
        label={`${stats.outcome.name} over time`}
      />
    </>
  );
}
