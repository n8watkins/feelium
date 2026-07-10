import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatDifferenceMagnitude,
  formatOutcomeAverage,
  type Comparison,
} from "@/lib/analytics";

/**
 * Behavior-to-outcome comparison card (PRD 16.4) - the key MVP feature. Leads with the
 * plain-language summary, then shows each side's average with a proportional bar (the bar
 * is decorative; the number beside it is the text equivalent), the difference, the inverse
 * phrasing, and a note that only days with both values recorded are compared (PRD 16.6).
 */
export function ComparisonCard({ comparison }: { comparison: Comparison }) {
  const c = comparison;
  const kind = c.outcomeKind;
  const fmt = (v: number | null) => formatOutcomeAverage(kind, c.unit, v);

  const domainMin = kind === "rating" ? 1 : 0;
  const domainMax =
    kind === "rating"
      ? 5
      : kind === "boolean"
        ? 1
        : Math.max(c.groupA.average ?? 0, c.groupB.average ?? 0, 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {c.behavior.name} and {c.outcome.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed">{c.phrasing?.direct}</p>

        <div className="space-y-3">
          <ComparisonRow
            label={c.groupA.label}
            days={c.groupA.days}
            valueText={fmt(c.groupA.average)}
            value={c.groupA.average}
            domainMin={domainMin}
            domainMax={domainMax}
          />
          <ComparisonRow
            label={c.groupB.label}
            days={c.groupB.days}
            valueText={fmt(c.groupB.average)}
            value={c.groupB.average}
            domainMin={domainMin}
            domainMax={domainMax}
          />
        </div>

        {c.difference != null ? (
          <div>
            <Badge variant="secondary" className="font-normal">
              Difference: {formatDifferenceMagnitude(kind, c.unit, c.difference)}
            </Badge>
          </div>
        ) : null}

        {c.phrasing?.inverse ? (
          <p className="text-xs text-muted-foreground">
            Put another way: {c.phrasing.inverse}
          </p>
        ) : null}

        <p className="text-[11px] leading-relaxed text-muted-foreground/80">
          Compares only days when both {c.behavior.name.toLowerCase()} and{" "}
          {c.outcome.name.toLowerCase()} were recorded. Where a day had several
          check-ins, its average is used. Associated with, not caused by.
        </p>
      </CardContent>
    </Card>
  );
}

function ComparisonRow({
  label,
  days,
  valueText,
  value,
  domainMin,
  domainMax,
}: {
  label: string;
  days: number;
  valueText: string;
  value: number | null;
  domainMin: number;
  domainMax: number;
}) {
  const span = domainMax - domainMin || 1;
  const pct =
    value == null ? 0 : Math.max(4, Math.round(((value - domainMin) / span) * 100));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          {label}{" "}
          <span className="text-xs">
            ({days} {days === 1 ? "day" : "days"})
          </span>
        </span>
        <span className="shrink-0 font-semibold tabular-nums">{valueText}</span>
      </div>
      <div
        className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-primary/70"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Shown instead of a comparison until the minimum-data thresholds are met (PRD 16.5):
 * "More recorded days are needed", with per-group progress toward five days each.
 */
export function ComparisonProgressCard({ comparison }: { comparison: Comparison }) {
  const { behavior, outcome, progress } = comparison;

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-sm">
          {behavior.name} and {outcome.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          More recorded days are needed before this comparison is available.
        </p>
        <ProgressRow
          label={progress.groupALabel}
          have={progress.groupAHave}
          need={progress.need}
        />
        <ProgressRow
          label={progress.groupBLabel}
          have={progress.groupBHave}
          need={progress.need}
        />
      </CardContent>
    </Card>
  );
}

function ProgressRow({
  label,
  have,
  need,
}: {
  label: string;
  have: number;
  need: number;
}) {
  const pct = Math.min(100, Math.round((have / need) * 100));
  const met = have >= need;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">
          {Math.min(have, need)} of {need} recorded{met ? " (met)" : ""}
        </span>
      </div>
      <div
        className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-primary/60"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
