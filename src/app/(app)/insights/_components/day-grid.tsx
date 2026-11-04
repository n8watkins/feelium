import { formatNumber, type DayValue, type OutcomeStats } from "@/lib/analytics";
import { parseISODate } from "@/lib/date";
import { ArchivedBadge } from "./archived-badge";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const CELL = 24;
const GAP = 4;

/** 0..1 strength of a day's value on the outcome's own scale. */
function strength(stats: OutcomeStats, value: number): number {
  if (stats.kind === "rating") return (value - 1) / 4;
  if (stats.kind === "boolean") return value;
  const max = stats.highest ?? 1;
  return max > 0 ? value / max : 0;
}

/**
 * One outcome, day by day: a calendar grid (weeks as rows) shaded by the day's value,
 * darker meaning higher; a dashed square is a day with nothing recorded. SVG geometry
 * only (CSP). The legend and the summary line carry the same information as text.
 */
export function DayGrid({ stats }: { stats: OutcomeStats }) {
  const days: DayValue<number>[] = stats.days;
  const offset = parseISODate(days[0].date).getUTCDay();
  const rows = Math.ceil((offset + days.length) / 7);
  const width = 7 * CELL + 6 * GAP;
  const height = rows * CELL + (rows - 1) * GAP;
  const recorded = days.filter((d) => d.value != null).length;
  const summary =
    stats.kind === "boolean"
      ? `Yes on ${stats.yesDays}, no on ${stats.noDays} of ${recorded} recorded days`
      : `Average ${formatNumber(stats.average ?? 0)}${stats.kind === "rating" ? " of 5" : stats.unit ? ` ${stats.unit}` : ""} · ${recorded} of ${days.length} days recorded`;

  return (
    <figure className="rounded-3xl border border-border p-5">
      <figcaption className="mb-4 flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-2 font-medium">{stats.outcome.name}{stats.outcome.isActive ? null : <ArchivedBadge />}</span>
        <span className="text-right text-xs text-muted-foreground">{summary}</span>
      </figcaption>
      <div className="mx-auto max-w-xs">
        <svg viewBox={`0 -18 ${width} ${height + 18}`} className="h-auto w-full" role="img" aria-label={`${stats.outcome.name} for each of the last ${days.length} days. ${summary}.`}>
          {WEEKDAYS.map((d, i) => (
            <text key={i} x={i * (CELL + GAP) + CELL / 2} y="-6" textAnchor="middle" className="fill-muted-foreground text-[9px]">
              {d}
            </text>
          ))}
          {days.map((day, i) => {
            const slot = offset + i;
            const x = (slot % 7) * (CELL + GAP);
            const y = Math.floor(slot / 7) * (CELL + GAP);
            if (day.value == null) {
              return <rect key={day.date} x={x + 0.75} y={y + 0.75} width={CELL - 1.5} height={CELL - 1.5} rx="6" className="fill-none stroke-border" strokeWidth="1.5" strokeDasharray="3 3" />;
            }
            return (
              <rect key={day.date} x={x} y={y} width={CELL} height={CELL} rx="6" className="fill-foreground" fillOpacity={0.15 + 0.85 * strength(stats, day.value)}>
                <title>{`${day.date}: ${formatNumber(day.value)}`}</title>
              </rect>
            );
          })}
        </svg>
      </div>
      <div className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground" aria-hidden="true">
        <span>{stats.kind === "rating" ? "1" : stats.kind === "boolean" ? "No" : "Low"}</span>
        {(stats.kind === "boolean" ? [0, 1] : [0, 0.25, 0.5, 0.75, 1]).map((s) => (
          <svg key={s} viewBox="0 0 12 12" className="size-3">
            <rect width="12" height="12" rx="3" className="fill-foreground" fillOpacity={0.15 + 0.85 * s} />
          </svg>
        ))}
        <span>{stats.kind === "rating" ? "5" : stats.kind === "boolean" ? "Yes" : "High"}</span>
        <span className="ml-auto">Dashed: nothing recorded</span>
      </div>
    </figure>
  );
}
