import { formatNumber, type BehaviorStats } from "@/lib/analytics";
import { ArchivedBadge } from "./archived-badge";

/**
 * A behavior across the window, one bar per day: for yes/no behaviors a full bar on days
 * it happened, a faint one on days it didn't, and nothing where it wasn't recorded; for
 * numbers, bar height is the day's amount. SVG geometry only (CSP).
 */
export function FrequencyStrip({ stats }: { stats: BehaviorStats }) {
  const n = stats.days.length;
  const slot = 300 / n;
  const bar = Math.max(1, slot * 0.72);
  const max = stats.kind === "numeric" ? Math.max(stats.max ?? 1, 1) : 1;
  const summary =
    stats.kind === "boolean"
      ? `${stats.yesDays} of ${stats.recordedDays} recorded days`
      : `Average ${formatNumber(stats.average ?? 0)}${stats.unit ? ` ${stats.unit}` : ""} on ${stats.recordedDays} recorded days`;

  return (
    <li className="py-4">
      <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-medium">{stats.behavior.name}{stats.behavior.isActive ? null : <ArchivedBadge />}</span>
        <span className="text-right text-muted-foreground tabular-nums">{summary}</span>
      </div>
      <svg viewBox="0 0 300 24" preserveAspectRatio="none" className="h-6 w-full" role="img" aria-label={`${stats.behavior.name}, each of the last ${n} days: ${summary}`}>
        {stats.days.map((day, i) => {
          const x = i * slot + (slot - bar) / 2;
          if (day.value == null) {
            return <rect key={day.date} x={x} y="22" width={bar} height="2" className="fill-border" />;
          }
          if (stats.kind === "boolean") {
            return day.value ? (
              <rect key={day.date} x={x} y="0" width={bar} height="24" rx="1.5" className="fill-foreground" />
            ) : (
              <rect key={day.date} x={x} y="0" width={bar} height="24" rx="1.5" className="fill-muted" />
            );
          }
          const h = Math.max(2, (Number(day.value) / max) * 24);
          return <rect key={day.date} x={x} y={24 - h} width={bar} height={h} rx="1.5" className="fill-foreground" />;
        })}
      </svg>
    </li>
  );
}
