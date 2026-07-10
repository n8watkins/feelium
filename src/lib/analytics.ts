import type {
  BehaviorDirection,
  BehaviorInputType,
  OutcomeDirection,
  OutcomeInputType,
} from "@/db/schema";
import { parseISODate } from "@/lib/date";

/**
 * Pure analytics engine for the Insights tab (PRD 16). No database or React here - the
 * server data loader (src/server/data/analytics.ts) hands raw rows to computeInsights and
 * gets back everything the UI renders. Keeping this pure keeps the PRD's exacting
 * missing-data rules (16.6) verifiable in isolation.
 *
 * Rules preserved throughout:
 *   - Unknown (null) values are excluded; they are never treated as zero.
 *   - Zero is a valid numeric value.
 *   - A day counts in a behavior-outcome comparison only when BOTH values exist.
 *   - Days with several check-ins collapse to that day's average (disclosed in the UI).
 *   - Archived metrics still contribute wherever they hold recorded values.
 *   - No causal language (16.8): "associated with", "tended to be", "on days when".
 */

// ---------------------------------------------------------------------------
// Time ranges (PRD 16.1)
// ---------------------------------------------------------------------------

export type TimeRange = "7" | "30" | "90" | "all";

export const DEFAULT_RANGE: TimeRange = "30";

export const TIME_RANGES: {
  value: TimeRange;
  label: string;
  shortLabel: string;
  days: number | null;
}[] = [
  { value: "7", label: "Last 7 days", shortLabel: "7 days", days: 7 },
  { value: "30", label: "Last 30 days", shortLabel: "30 days", days: 30 },
  { value: "90", label: "Last 90 days", shortLabel: "90 days", days: 90 },
  { value: "all", label: "All time", shortLabel: "All", days: null },
];

export function isTimeRange(v: string | undefined | null): v is TimeRange {
  return v === "7" || v === "30" || v === "90" || v === "all";
}

export function rangeLabel(range: TimeRange): string {
  return TIME_RANGES.find((r) => r.value === range)?.label ?? "Last 30 days";
}

/** Minimum explicit days on each side before a comparison is shown (PRD 16.5). */
export const MIN_COMPARISON_DAYS = 5;

// ---------------------------------------------------------------------------
// Raw input shapes (loaded by the server; kept plain/serializable)
// ---------------------------------------------------------------------------

export type BehaviorMeta = {
  id: string;
  name: string;
  inputType: BehaviorInputType;
  desiredDirection: BehaviorDirection;
  unit: string | null;
  isActive: boolean;
};

export type OutcomeMeta = {
  id: string;
  name: string;
  inputType: OutcomeInputType;
  desiredDirection: OutcomeDirection | null;
  unit: string | null;
  isActive: boolean;
};

/** One daily behavior entry. A null value column means "not recorded" for that day. */
export type BehaviorEntryRow = {
  behaviorId: string;
  entryDate: string; // ISO 'YYYY-MM-DD'
  booleanValue: boolean | null;
  numericValue: number | null;
};

/** One outcome value from one check-in. occurredAt is epoch ms (latest-boolean tiebreak). */
export type OutcomeValueRow = {
  outcomeMetricId: string;
  localDate: string; // ISO 'YYYY-MM-DD'
  occurredAt: number;
  rating: number | null;
  boolean: boolean | null;
  numeric: number | null;
};

export type InsightsInput = {
  range: TimeRange;
  today: string; // ISO 'YYYY-MM-DD'
  behaviors: BehaviorMeta[];
  outcomes: OutcomeMeta[];
  entries: BehaviorEntryRow[];
  values: OutcomeValueRow[];
};

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** One-decimal number, trimming a trailing ".0" (matches the History summaries). */
export function formatNumber(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function pluralPoints(magnitude: string): string {
  return magnitude === "1" ? "point" : "points";
}

/** Display an outcome's average, given the metric kind (rating -> "/5", boolean -> "%"). */
export function formatOutcomeAverage(
  kind: OutcomeInputType,
  unit: string | null,
  value: number | null,
): string {
  if (value == null) return "—";
  if (kind === "boolean") return `${Math.round(value * 100)}%`;
  if (kind === "rating") return `${formatNumber(value)} / 5`;
  return `${formatNumber(value)}${unit ? ` ${unit}` : ""}`;
}

/** Display a signed difference magnitude with its unit words. */
export function formatDifferenceMagnitude(
  kind: OutcomeInputType,
  unit: string | null,
  difference: number,
): string {
  const mag = Math.abs(difference);
  if (kind === "boolean") return `${Math.round(mag * 100)} percentage points`;
  if (kind === "rating") {
    const n = formatNumber(mag);
    return `${n} ${pluralPoints(n)}`;
  }
  const n = formatNumber(mag);
  return unit ? `${n} ${unit}` : `${n} ${pluralPoints(n)}`;
}

// ---------------------------------------------------------------------------
// Date helpers (local calendar, matching src/lib/date.ts)
// ---------------------------------------------------------------------------

function addDaysISO(iso: string, delta: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + delta);
  return d.toLocaleDateString("en-CA");
}

/** Inclusive day count between two ISO dates (same date -> 1). */
function inclusiveDaySpan(startISO: string, endISO: string): number {
  const start = parseISODate(startISO).getTime();
  const end = parseISODate(endISO).getTime();
  return Math.floor((end - start) / 86_400_000) + 1;
}

/**
 * Window bounds for a range. For a fixed range the window is exactly N days ending today.
 * For "all", it spans from the earliest recorded day to today, so "unrecorded days" stays
 * meaningful. Returns null start when there is nothing recorded at all.
 */
function windowBounds(
  range: TimeRange,
  today: string,
  earliestRecorded: string | null,
): { startISO: string | null; days: number } {
  const fixed = TIME_RANGES.find((r) => r.value === range)?.days ?? null;
  if (fixed != null) {
    return { startISO: addDaysISO(today, -(fixed - 1)), days: fixed };
  }
  if (!earliestRecorded) return { startISO: null, days: 0 };
  return {
    startISO: earliestRecorded,
    days: inclusiveDaySpan(earliestRecorded, today),
  };
}

function inWindow(dateISO: string, startISO: string | null, today: string): boolean {
  if (dateISO > today) return false;
  if (startISO && dateISO < startISO) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Trend (PRD 16.2/16.3 "basic trend over time") - deliberately not correlation math
// ---------------------------------------------------------------------------

export type TrendDirection = "up" | "down" | "flat" | "insufficient";

export type TrendBucket = {
  label: string; // short human date of the bucket's start
  value: number | null; // mean of daily values in the bucket, null when the bucket is empty
};

export type Trend = {
  direction: TrendDirection;
  buckets: TrendBucket[];
  domainMin: number;
  domainMax: number;
};

type DailyPoint = { date: string; value: number };

/**
 * Splits recorded days into a first and second half and compares their means. `flatEps` is
 * the smallest mean change treated as a real move (occurrence rates use a wider band than
 * a 1-5 rating). Fewer than four recorded days is reported as "insufficient".
 */
function trendDirection(points: DailyPoint[], flatEps: number): TrendDirection {
  if (points.length < 4) return "insufficient";
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(sorted.length - mid);
  const mean = (xs: DailyPoint[]) =>
    xs.reduce((sum, p) => sum + p.value, 0) / xs.length;
  const delta = mean(secondHalf) - mean(firstHalf);
  if (Math.abs(delta) < flatEps) return "flat";
  return delta > 0 ? "up" : "down";
}

/**
 * Buckets daily points into <=8 evenly sized calendar spans for a compact sparkline.
 * Empty buckets keep a null value so gaps stay visible rather than being smoothed over.
 */
function bucketPoints(
  points: DailyPoint[],
  startISO: string,
  today: string,
): TrendBucket[] {
  const totalDays = Math.max(1, inclusiveDaySpan(startISO, today));
  const maxBuckets = 8;
  const bucketCount = Math.min(totalDays, maxBuckets);
  const span = Math.ceil(totalDays / bucketCount);

  const byDate = new Map(points.map((p) => [p.date, p.value]));
  const buckets: TrendBucket[] = [];
  for (let offset = 0; offset < totalDays; offset += span) {
    const bucketStart = addDaysISO(startISO, offset);
    const bucketEnd = addDaysISO(startISO, Math.min(offset + span - 1, totalDays - 1));
    let sum = 0;
    let count = 0;
    for (const [date, value] of byDate) {
      if (date >= bucketStart && date <= bucketEnd) {
        sum += value;
        count += 1;
      }
    }
    buckets.push({
      label: parseISODate(bucketStart).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      value: count > 0 ? sum / count : null,
    });
  }
  return buckets;
}

function buildTrend(
  points: DailyPoint[],
  startISO: string | null,
  today: string,
  flatEps: number,
  domain: { min: number; max: number },
): Trend {
  const direction = trendDirection(points, flatEps);
  const buckets = startISO ? bucketPoints(points, startISO, today) : [];
  return { direction, buckets, domainMin: domain.min, domainMax: domain.max };
}

// ---------------------------------------------------------------------------
// Behavior analytics (PRD 16.2)
// ---------------------------------------------------------------------------

export type BooleanBehaviorStats = {
  kind: "boolean";
  behavior: BehaviorMeta;
  hasData: boolean;
  yesDays: number;
  noDays: number;
  recordedDays: number;
  unrecordedDays: number;
  windowDays: number;
  percentOccurred: number | null; // yes / recorded * 100 (recorded-only denominator)
  trend: Trend;
};

export type NumericBehaviorStats = {
  kind: "numeric";
  behavior: BehaviorMeta;
  hasData: boolean;
  recordedDays: number;
  unrecordedDays: number;
  windowDays: number;
  average: number | null;
  total: number;
  min: number | null;
  max: number | null;
  unit: string | null;
  trend: Trend;
};

export type BehaviorStats = BooleanBehaviorStats | NumericBehaviorStats;

function computeBooleanBehavior(
  behavior: BehaviorMeta,
  rows: BehaviorEntryRow[],
  startISO: string | null,
  today: string,
  windowDays: number,
): BooleanBehaviorStats {
  // One explicit value per day (unique constraint guarantees at most one row per date).
  const byDate = new Map<string, boolean>();
  for (const row of rows) {
    if (row.booleanValue == null) continue; // unknown excluded (16.6)
    if (!inWindow(row.entryDate, startISO, today)) continue;
    byDate.set(row.entryDate, row.booleanValue);
  }
  let yesDays = 0;
  let noDays = 0;
  const points: DailyPoint[] = [];
  for (const [date, value] of byDate) {
    if (value) yesDays += 1;
    else noDays += 1;
    points.push({ date, value: value ? 1 : 0 });
  }
  const recordedDays = yesDays + noDays;
  return {
    kind: "boolean",
    behavior,
    hasData: recordedDays > 0,
    yesDays,
    noDays,
    recordedDays,
    unrecordedDays: Math.max(0, windowDays - recordedDays),
    windowDays,
    percentOccurred: recordedDays > 0 ? (yesDays / recordedDays) * 100 : null,
    trend: buildTrend(points, startISO, today, 0.15, { min: 0, max: 1 }),
  };
}

function computeNumericBehavior(
  behavior: BehaviorMeta,
  rows: BehaviorEntryRow[],
  startISO: string | null,
  today: string,
  windowDays: number,
): NumericBehaviorStats {
  const byDate = new Map<string, number>();
  for (const row of rows) {
    if (row.numericValue == null) continue; // unknown excluded; note 0 is kept (16.6)
    if (!inWindow(row.entryDate, startISO, today)) continue;
    byDate.set(row.entryDate, row.numericValue);
  }
  const values = [...byDate.values()];
  const points: DailyPoint[] = [...byDate].map(([date, value]) => ({ date, value }));
  const recordedDays = values.length;
  const total = values.reduce((sum, v) => sum + v, 0);
  const min = recordedDays > 0 ? Math.min(...values) : null;
  const max = recordedDays > 0 ? Math.max(...values) : null;
  const span = min != null && max != null ? max - min : 0;
  return {
    kind: "numeric",
    behavior,
    hasData: recordedDays > 0,
    recordedDays,
    unrecordedDays: Math.max(0, windowDays - recordedDays),
    windowDays,
    average: recordedDays > 0 ? total / recordedDays : null,
    total,
    min,
    max,
    unit: behavior.unit,
    trend: buildTrend(points, startISO, today, Math.max(0.1, span * 0.05), {
      min: min ?? 0,
      max: max ?? 1,
    }),
  };
}

// ---------------------------------------------------------------------------
// Outcome analytics (PRD 16.3) - daily averages with disclosure
// ---------------------------------------------------------------------------

export type OutcomeStats = {
  outcome: OutcomeMeta;
  kind: OutcomeInputType;
  hasData: boolean;
  checkInCount: number; // raw count of recorded values in the window
  recordedDays: number; // days with at least one recorded value
  multiCheckInDays: number; // days with more than one recorded value (disclosure)
  // rating / numeric (computed over each day's average):
  average: number | null;
  lowest: number | null;
  highest: number | null;
  unit: string | null;
  // boolean:
  yesDays: number;
  noDays: number;
  trend: Trend;
};

/** A day's collapsed value for one outcome (PRD 16.6: several check-ins -> daily average). */
function dailyOutcomeValue(
  kind: OutcomeInputType,
  dayRows: OutcomeValueRow[],
): number | null {
  if (kind === "boolean") {
    const withBool = dayRows
      .filter((r) => r.boolean != null)
      .sort((a, b) => b.occurredAt - a.occurredAt);
    if (withBool.length === 0) return null;
    return withBool[0].boolean ? 1 : 0; // latest recorded boolean wins (matches History)
  }
  const pick = (r: OutcomeValueRow) => (kind === "rating" ? r.rating : r.numeric);
  const nums = dayRows.map(pick).filter((x): x is number => x != null);
  if (nums.length === 0) return null;
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

/** Number of recorded (non-null) values a day holds for one outcome. */
function dailyRecordedCount(kind: OutcomeInputType, dayRows: OutcomeValueRow[]): number {
  const pick = (r: OutcomeValueRow) =>
    kind === "rating" ? r.rating : kind === "numeric" ? r.numeric : r.boolean;
  return dayRows.filter((r) => pick(r) != null).length;
}

/** Groups a metric's window values by localDate. */
function groupByDate(rows: OutcomeValueRow[]): Map<string, OutcomeValueRow[]> {
  const byDate = new Map<string, OutcomeValueRow[]>();
  for (const row of rows) {
    const list = byDate.get(row.localDate);
    if (list) list.push(row);
    else byDate.set(row.localDate, [row]);
  }
  return byDate;
}

function computeOutcome(
  outcome: OutcomeMeta,
  rows: OutcomeValueRow[],
  startISO: string | null,
  today: string,
): OutcomeStats {
  const kind = outcome.inputType;
  const windowRows = rows.filter((r) => inWindow(r.localDate, startISO, today));
  const byDate = groupByDate(windowRows);

  let checkInCount = 0;
  let recordedDays = 0;
  let multiCheckInDays = 0;
  const dailyValues: DailyPoint[] = [];
  let yesDays = 0;
  let noDays = 0;

  for (const [date, dayRows] of byDate) {
    const recorded = dailyRecordedCount(kind, dayRows);
    if (recorded === 0) continue;
    checkInCount += recorded;
    recordedDays += 1;
    if (recorded > 1) multiCheckInDays += 1;
    const value = dailyOutcomeValue(kind, dayRows);
    if (value == null) continue;
    dailyValues.push({ date, value });
    if (kind === "boolean") {
      if (value >= 0.5) yesDays += 1;
      else noDays += 1;
    }
  }

  const numericDaily = dailyValues.map((p) => p.value);
  const average =
    kind === "boolean" || numericDaily.length === 0
      ? null
      : numericDaily.reduce((sum, v) => sum + v, 0) / numericDaily.length;
  const lowest = kind === "boolean" || numericDaily.length === 0 ? null : Math.min(...numericDaily);
  const highest = kind === "boolean" || numericDaily.length === 0 ? null : Math.max(...numericDaily);
  const span = lowest != null && highest != null ? highest - lowest : 0;
  const flatEps = kind === "rating" ? 0.25 : kind === "boolean" ? 0.15 : Math.max(0.1, span * 0.05);

  return {
    outcome,
    kind,
    hasData: recordedDays > 0,
    checkInCount,
    recordedDays,
    multiCheckInDays,
    average,
    lowest,
    highest,
    unit: outcome.unit,
    yesDays,
    noDays,
    trend: buildTrend(dailyValues, startISO, today, flatEps, {
      min: lowest ?? (kind === "rating" ? 1 : 0),
      max: highest ?? (kind === "rating" ? 5 : 1),
    }),
  };
}

// ---------------------------------------------------------------------------
// Behavior-to-outcome comparison (PRD 16.4/16.5/16.7) - the key MVP feature
// ---------------------------------------------------------------------------

export type ComparisonPhrasing = {
  direct: string;
  inverse: string;
};

export type ComparisonGroup = {
  label: string; // "Days when you recorded doomscrolling"
  days: number;
  average: number | null;
};

export type Comparison = {
  behavior: BehaviorMeta;
  outcome: OutcomeMeta;
  outcomeKind: OutcomeInputType;
  unit: string | null;
  // "yes-no" for boolean behaviors; "zero-nonzero" for numeric behaviors (PRD 16.7).
  variant: "yes-no" | "zero-nonzero";
  eligible: boolean;
  groupA: ComparisonGroup; // Yes days / days-with-behavior
  groupB: ComparisonGroup; // No days / days-without-behavior
  difference: number | null; // groupA.average - groupB.average
  phrasing: ComparisonPhrasing | null;
  progress: {
    need: number;
    groupALabel: string;
    groupAHave: number;
    groupBLabel: string;
    groupBHave: number;
  };
};

type ComparisonClauses = {
  aWith: string; // "when you recorded doomscrolling" / "with coffee"
  bWith: string; // "when you did not record doomscrolling" / "without coffee"
  aShort: string; // "Yes" side short label for the progress card
  bShort: string;
};

function comparisonClauses(
  variant: "yes-no" | "zero-nonzero",
  behaviorName: string,
): ComparisonClauses {
  const name = behaviorName.toLowerCase();
  if (variant === "yes-no") {
    return {
      aWith: `when you recorded ${name}`,
      bWith: `when you did not record ${name}`,
      aShort: `Yes days for ${behaviorName}`,
      bShort: `No days for ${behaviorName}`,
    };
  }
  return {
    aWith: `with ${name}`,
    bWith: `without ${name}`,
    aShort: `Days with ${behaviorName}`,
    bShort: `Days without ${behaviorName}`,
  };
}

/**
 * Plain-language summary of a comparison (PRD 16.8). Deliberately uses "tended to be",
 * "on days", and "associated with" - never "caused", "leads to", "predicts", etc. Offers
 * both the direct and inverse phrasing from the same numbers (PRD 16.4).
 */
function buildComparisonPhrasing(
  outcome: OutcomeMeta,
  kind: OutcomeInputType,
  unit: string | null,
  difference: number,
  clauses: ComparisonClauses,
): ComparisonPhrasing {
  const outcomeName = outcome.name.toLowerCase();
  const magnitude = formatDifferenceMagnitude(kind, unit, difference);
  const isFlat = formatNumber(Math.abs(difference)) === "0" && kind !== "boolean";

  if (isFlat) {
    return {
      direct: `Based on your recorded data, your ${outcomeName} tended to be about the same on days ${clauses.aWith} and on days ${clauses.bWith}.`,
      inverse: `The average ${outcomeName} was close to equal whether or not the day was ${clauses.aWith.replace(/^when you |^with |^without /, "")}.`,
    };
  }

  if (kind === "boolean") {
    // difference is a proportion; describe it in occurrence terms.
    const higher = difference > 0;
    return {
      direct: `Based on your recorded data, your ${outcomeName} was recorded on ${magnitude} more of the days ${higher ? clauses.aWith : clauses.bWith} than the days ${higher ? clauses.bWith : clauses.aWith}.`,
      inverse: `On days ${higher ? clauses.bWith : clauses.aWith}, your ${outcomeName} was recorded less often.`,
    };
  }

  const higher = difference > 0; // group A (Yes / with) had the higher average
  return {
    direct: `Based on your recorded data, your ${outcomeName} tended to be ${magnitude} ${higher ? "higher" : "lower"} on days ${clauses.aWith}.`,
    inverse: `On days ${clauses.bWith}, your ${outcomeName} tended to be ${higher ? "lower" : "higher"}.`,
  };
}

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((sum, v) => sum + v, 0) / xs.length;
}

/**
 * Builds one comparison of an outcome across two groups of days defined by a behavior.
 * Only days where BOTH the behavior value and the outcome value exist are counted (16.6).
 */
function computeComparison(
  behavior: BehaviorMeta,
  outcome: OutcomeMeta,
  variant: "yes-no" | "zero-nonzero",
  behaviorByDate: Map<string, boolean>, // date -> group A membership (Yes / nonzero)
  outcomeByDate: Map<string, number>, // date -> daily outcome value (already collapsed)
): Comparison {
  const kind = outcome.inputType;
  const unit = outcome.unit;
  const clauses = comparisonClauses(variant, behavior.name);

  const aValues: number[] = [];
  const bValues: number[] = [];
  for (const [date, inGroupA] of behaviorByDate) {
    const value = outcomeByDate.get(date);
    if (value == null) continue; // needs both values present (16.6)
    if (inGroupA) aValues.push(value);
    else bValues.push(value);
  }

  const eligible =
    aValues.length >= MIN_COMPARISON_DAYS && bValues.length >= MIN_COMPARISON_DAYS;
  const avgA = mean(aValues);
  const avgB = mean(bValues);
  const difference = avgA != null && avgB != null ? avgA - avgB : null;

  const aLabel =
    variant === "yes-no"
      ? `Days when you recorded ${behavior.name.toLowerCase()}`
      : `Days with ${behavior.name.toLowerCase()}`;
  const bLabel =
    variant === "yes-no"
      ? `Days when you did not`
      : `Days without ${behavior.name.toLowerCase()}`;

  return {
    behavior,
    outcome,
    outcomeKind: kind,
    unit,
    variant,
    eligible,
    groupA: { label: aLabel, days: aValues.length, average: avgA },
    groupB: { label: bLabel, days: bValues.length, average: avgB },
    difference,
    phrasing:
      eligible && difference != null
        ? buildComparisonPhrasing(outcome, kind, unit, difference, clauses)
        : null,
    progress: {
      need: MIN_COMPARISON_DAYS,
      groupALabel: clauses.aShort,
      groupAHave: aValues.length,
      groupBLabel: clauses.bShort,
      groupBHave: bValues.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Top-level engine
// ---------------------------------------------------------------------------

export type InsightsData = {
  range: TimeRange;
  windowStartISO: string | null;
  windowDays: number;
  hasAnyData: boolean;
  behaviors: BehaviorStats[];
  outcomes: OutcomeStats[];
  comparisons: Comparison[];
};

function earliestRecordedDate(
  entries: BehaviorEntryRow[],
  values: OutcomeValueRow[],
): string | null {
  let earliest: string | null = null;
  const consider = (date: string) => {
    if (earliest == null || date < earliest) earliest = date;
  };
  for (const e of entries) {
    if (e.booleanValue != null || e.numericValue != null) consider(e.entryDate);
  }
  for (const v of values) {
    if (v.rating != null || v.boolean != null || v.numeric != null) consider(v.localDate);
  }
  return earliest;
}

export function computeInsights(input: InsightsInput): InsightsData {
  const { range, today, behaviors, outcomes, entries, values } = input;

  const earliest = earliestRecordedDate(entries, values);
  const { startISO, days: windowDays } = windowBounds(range, today, earliest);

  const entriesByBehavior = new Map<string, BehaviorEntryRow[]>();
  for (const e of entries) {
    const list = entriesByBehavior.get(e.behaviorId);
    if (list) list.push(e);
    else entriesByBehavior.set(e.behaviorId, [e]);
  }

  const valuesByOutcome = new Map<string, OutcomeValueRow[]>();
  for (const v of values) {
    const list = valuesByOutcome.get(v.outcomeMetricId);
    if (list) list.push(v);
    else valuesByOutcome.set(v.outcomeMetricId, [v]);
  }

  // Behavior analytics - keep only behaviors that hold recorded data in the window, so
  // archived behaviors with history still appear (16.6) and idle ones don't clutter.
  const behaviorStats: BehaviorStats[] = behaviors
    .map((b) => {
      const rows = entriesByBehavior.get(b.id) ?? [];
      return b.inputType === "boolean"
        ? computeBooleanBehavior(b, rows, startISO, today, windowDays)
        : computeNumericBehavior(b, rows, startISO, today, windowDays);
    })
    .filter((s) => s.hasData);

  const outcomeStats: OutcomeStats[] = outcomes
    .map((o) => computeOutcome(o, valuesByOutcome.get(o.id) ?? [], startISO, today))
    .filter((s) => s.hasData);

  // Comparisons: every behavior vs every outcome that has data. Boolean behaviors use a
  // Yes/No split; numeric behaviors use a zero/nonzero split (PRD 16.7).
  const comparisons: Comparison[] = [];
  for (const b of behaviors) {
    const rows = (entriesByBehavior.get(b.id) ?? []).filter((r) =>
      inWindow(r.entryDate, startISO, today),
    );

    const behaviorByDate = new Map<string, boolean>();
    if (b.inputType === "boolean") {
      for (const r of rows) {
        if (r.booleanValue == null) continue;
        behaviorByDate.set(r.entryDate, r.booleanValue);
      }
    } else {
      for (const r of rows) {
        if (r.numericValue == null) continue; // 0 is a real value -> counts as "no/zero" group
        behaviorByDate.set(r.entryDate, r.numericValue !== 0);
      }
    }
    if (behaviorByDate.size === 0) continue;
    const variant = b.inputType === "boolean" ? "yes-no" : "zero-nonzero";

    for (const o of outcomes) {
      const oRows = (valuesByOutcome.get(o.id) ?? []).filter((r) =>
        inWindow(r.localDate, startISO, today),
      );
      if (oRows.length === 0) continue;

      const outcomeByDate = new Map<string, number>();
      for (const [date, dayRows] of groupByDate(oRows)) {
        const value = dailyOutcomeValue(o.inputType, dayRows);
        if (value != null) outcomeByDate.set(date, value);
      }
      if (outcomeByDate.size === 0) continue;

      comparisons.push(
        computeComparison(b, o, variant, behaviorByDate, outcomeByDate),
      );
    }
  }

  // Eligible comparisons first, then by the strength of the (absolute) difference so the
  // most noticeable associations surface at the top.
  comparisons.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    const da = Math.abs(a.difference ?? 0);
    const db = Math.abs(b.difference ?? 0);
    return db - da;
  });

  return {
    range,
    windowStartISO: startISO,
    windowDays,
    hasAnyData: behaviorStats.length > 0 || outcomeStats.length > 0,
    behaviors: behaviorStats,
    outcomes: outcomeStats,
    comparisons,
  };
}

/** Human phrase for a trend direction in a given subject context (no causal words). */
export function describeTrend(
  direction: TrendDirection,
  subject: "occurrence" | "value",
): string {
  if (direction === "insufficient") return "Not enough days yet to show a trend";
  if (direction === "flat") {
    return subject === "occurrence"
      ? "About as often as earlier in this period"
      : "About the same across this period";
  }
  const word = direction === "up" ? "higher" : "lower";
  return subject === "occurrence"
    ? `Recorded ${direction === "up" ? "more" : "less"} often later in this period`
    : `Tended to be ${word} later in this period`;
}
