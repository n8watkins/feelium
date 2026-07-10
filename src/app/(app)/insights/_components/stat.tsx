/** A single labelled statistic in a compact stat grid. */
export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-lg leading-tight font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {hint ? <div className="text-[11px] text-muted-foreground/80">{hint}</div> : null}
    </div>
  );
}
