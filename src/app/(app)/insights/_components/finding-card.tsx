import {
  formatDifferenceMagnitude,
  formatOutcomeAverage,
  type Comparison,
} from "@/lib/analytics";

/** "Based on your recorded data, your anxiety tended to…" reads as the card's caveat; lead with the finding. */
function headline(direct: string): string {
  const trimmed = direct.replace(/^Based on your recorded data,\s*/i, "");
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * A comparison that has enough data (PRD 16.4/16.5), led by its plain-language finding.
 * Below it, both groups as dots on the outcome's own scale (the numbers beside them are
 * the text equivalent), then the caveat. Pure SVG geometry: no inline styles (CSP).
 */
export function FindingCard({ comparison: c }: { comparison: Comparison }) {
  const kind = c.outcomeKind;
  const domainMin = kind === "rating" ? 1 : 0;
  const domainMax =
    kind === "rating" ? 5 : kind === "boolean" ? 1 : Math.max(c.groupA.average ?? 0, c.groupB.average ?? 0, 1);
  const ticks =
    kind === "rating" ? [1, 2, 3, 4, 5] : [domainMin, (domainMin + domainMax) / 2, domainMax];
  const x = (v: number) => 8 + ((v - domainMin) / (domainMax - domainMin || 1)) * 284;
  const scaleLabel =
    kind === "rating" ? `${c.outcome.name}, 1 to 5` : kind === "boolean" ? `${c.outcome.name}, % of days` : `${c.outcome.name}${c.unit ? `, ${c.unit}` : ""}`;

  return (
    <article className="flex flex-col rounded-3xl border border-border p-5 md:p-7">
      <h3 className="text-xl leading-snug font-medium tracking-[-0.02em] text-pretty md:text-[22px]">
        {c.phrasing ? headline(c.phrasing.direct) : `${c.behavior.name} and ${c.outcome.name}`}
      </h3>
      <dl className="mt-6 space-y-3">
        {[
          { ...c.groupA, short: `With ${c.behavior.name.toLowerCase()}` },
          { ...c.groupB, short: "Without" },
        ].map((group, i) => (
          <div key={group.short} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3">
            <dt className="text-sm leading-tight text-muted-foreground">
              <span className="sr-only">{group.label}: </span>
              <span aria-hidden="true">{group.short}</span>
              <span className="block text-xs">{group.days} {group.days === 1 ? "day" : "days"}</span>
            </dt>
            <svg viewBox="0 0 300 20" className="h-5 w-full overflow-visible text-foreground" aria-hidden="true">
              <line x1="8" y1="10" x2="292" y2="10" className="stroke-border" strokeWidth="1.5" />
              {ticks.map((t) => (
                <line key={t} x1={x(t)} y1="6" x2={x(t)} y2="14" className="stroke-input" strokeWidth="1.5" />
              ))}
              {group.average != null ? (
                i === 0 ? (
                  <circle cx={x(group.average)} cy="10" r="7" className="fill-foreground" />
                ) : (
                  <circle cx={x(group.average)} cy="10" r="6" className="fill-background stroke-foreground" strokeWidth="2.5" />
                )
              ) : null}
            </svg>
            <dd className="min-w-12 text-right text-sm font-semibold whitespace-nowrap tabular-nums">
              {formatOutcomeAverage(kind, c.unit, group.average)}
            </dd>
          </div>
        ))}
        <div className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] gap-3 text-[11px] text-muted-foreground">
          <span />
          <span className="text-center">{scaleLabel}</span>
          <span />
        </div>
      </dl>
      <p className="mt-auto pt-4 text-xs leading-relaxed text-muted-foreground">
        {c.difference != null ? `A difference of ${formatDifferenceMagnitude(kind, c.unit, c.difference)}. ` : ""}
        Only days with both recorded count, and a day with several check-ins uses its average.
        It&apos;s an association in your data, not a cause.
      </p>
    </article>
  );
}

/** A comparison still short of five days on each side (PRD 16.5): how close it is. */
export function ProgressRow({ comparison: c }: { comparison: Comparison }) {
  const { progress } = c;
  const left = Math.max(0, progress.need - progress.groupAHave) + Math.max(0, progress.need - progress.groupBHave);
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <span className="min-w-0 text-sm">
        <span className="font-medium">{c.behavior.name} and {c.outcome.name}</span>
        <span className="block text-xs text-muted-foreground">
          {progress.groupALabel}: {Math.min(progress.groupAHave, progress.need)} of {progress.need} · {progress.groupBLabel}: {Math.min(progress.groupBHave, progress.need)} of {progress.need}
        </span>
      </span>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {left} {left === 1 ? "day" : "days"} to go
      </span>
    </li>
  );
}
