import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatNumber,
  type BooleanBehaviorStats,
  type NumericBehaviorStats,
  type BehaviorStats,
} from "@/lib/analytics";
import { ArchivedBadge } from "./archived-badge";
import { Stat } from "./stat";
import { TrendChart } from "./trend-chart";

/** Behavior analytics card (PRD 16.2): yes/no frequency or numeric summary, plus a trend. */
export function BehaviorCard({ stats }: { stats: BehaviorStats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {stats.behavior.name}
          {!stats.behavior.isActive ? <ArchivedBadge /> : null}
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

function BooleanBody({ stats }: { stats: BooleanBehaviorStats }) {
  const { yesDays, noDays, recordedDays, unrecordedDays, percentOccurred } = stats;
  // For a behavior the user wants to reduce, lead with the No days (PRD 16.2).
  const reduce = stats.behavior.desiredDirection === "reduce";

  return (
    <>
      <p className="text-sm leading-relaxed">
        {reduce ? (
          <>
            Did not occur on <strong>{noDays}</strong> of{" "}
            <strong>{recordedDays}</strong> recorded {dayWord(recordedDays)}. Occurred
            on <strong>{yesDays}</strong> of <strong>{recordedDays}</strong>.
          </>
        ) : (
          <>
            Occurred on <strong>{yesDays}</strong> of{" "}
            <strong>{recordedDays}</strong> recorded {dayWord(recordedDays)}. Did not
            occur on <strong>{noDays}</strong> of <strong>{recordedDays}</strong>.
          </>
        )}
        {unrecordedDays > 0 ? (
          <>
            {" "}
            {unrecordedDays} {dayWord(unrecordedDays)} had no entry.
          </>
        ) : null}
      </p>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Yes days" value={String(yesDays)} />
        <Stat label="No days" value={String(noDays)} />
        <Stat
          label="Occurred"
          value={percentOccurred != null ? `${Math.round(percentOccurred)}%` : "—"}
          hint="of recorded days"
        />
      </div>

      <TrendChart
        trend={stats.trend}
        subject="occurrence"
        formatValue={(n) => `${Math.round(n * 100)}% of days`}
        label={`${stats.behavior.name} occurrence over time`}
      />
    </>
  );
}

function NumericBody({ stats }: { stats: NumericBehaviorStats }) {
  const unit = stats.unit ? ` ${stats.unit}` : "";
  const fmt = (n: number) => `${formatNumber(n)}${unit}`;

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Recorded on{" "}
        <strong className="text-foreground">{stats.recordedDays}</strong> of{" "}
        {stats.windowDays} {dayWord(stats.windowDays)}.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Average"
          value={stats.average != null ? fmt(stats.average) : "—"}
        />
        <Stat label="Total" value={fmt(stats.total)} />
        <Stat label="Lowest" value={stats.min != null ? fmt(stats.min) : "—"} />
        <Stat label="Highest" value={stats.max != null ? fmt(stats.max) : "—"} />
      </div>

      <TrendChart
        trend={stats.trend}
        subject="value"
        formatValue={fmt}
        label={`${stats.behavior.name} over time`}
      />
    </>
  );
}
