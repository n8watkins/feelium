import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  behaviors,
  checkInTags,
  checkInValues,
  checkIns,
  dailyBehaviorEntries,
  outcomeMetrics,
  tags,
  type BehaviorInputType,
  type OutcomeInputType,
} from "@/db/schema";
import { requireUserId } from "./session";

// ---------------------------------------------------------------------------
// History list (PRD 15.1)
// ---------------------------------------------------------------------------

/** A single outcome's summarized value for a day (averaged, or latest for booleans). */
export type HistoryOutcomeSummary = {
  outcomeMetricId: string;
  name: string;
  value: string;
};

export type HistoryDay = {
  date: string; // ISO 'YYYY-MM-DD'
  behaviorCount: number;
  checkInCount: number;
  outcomes: HistoryOutcomeSummary[];
  tags: string[];
  notePreview: string | null;
};

type DayValue = {
  occurredAt: Date;
  rating: number | null;
  boolean: boolean | null;
  numeric: number | null;
};

function formatAverage(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Collapses a day's several check-in values for one outcome into a single summary
 * (PRD 16.6: a day with several outcome check-ins uses the daily average). Booleans have
 * no meaningful average, so we surface the latest recorded value instead. Nulls (unknown)
 * are excluded; returns null when nothing was recorded for the metric that day.
 */
function summarizeOutcome(
  inputType: OutcomeInputType,
  unit: string | null,
  values: DayValue[],
): string | null {
  if (inputType === "rating") {
    const nums = values
      .map((v) => v.rating)
      .filter((x): x is number => x != null);
    if (nums.length === 0) return null;
    return `${formatAverage(nums.reduce((a, b) => a + b, 0) / nums.length)}/5`;
  }
  if (inputType === "numeric") {
    const nums = values
      .map((v) => v.numeric)
      .filter((x): x is number => x != null);
    if (nums.length === 0) return null;
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    return `${formatAverage(avg)}${unit ? ` ${unit}` : ""}`;
  }
  const withBoolean = values
    .filter((v) => v.boolean != null)
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  if (withBoolean.length === 0) return null;
  return withBoolean[0].boolean ? "Yes" : "No";
}

/**
 * Every day the user has recorded data (behavior entries and/or check-ins), newest first.
 * Only days with data are returned. Archived metrics are included wherever they hold
 * recorded values (PRD 16.6), because history never hides data behind a later archive.
 */
export async function listHistoryDays(): Promise<HistoryDay[]> {
  const userId = await requireUserId();

  const [entryRows, checkInRows, valueRows, tagRows] = await Promise.all([
    db
      .select({
        entryDate: dailyBehaviorEntries.entryDate,
        booleanValue: dailyBehaviorEntries.booleanValue,
        numericValue: dailyBehaviorEntries.numericValue,
      })
      .from(dailyBehaviorEntries)
      .where(eq(dailyBehaviorEntries.userId, userId)),
    db
      .select({
        localDate: checkIns.localDate,
        occurredAt: checkIns.occurredAt,
        note: checkIns.note,
      })
      .from(checkIns)
      .where(eq(checkIns.userId, userId)),
    db
      .select({
        localDate: checkIns.localDate,
        occurredAt: checkIns.occurredAt,
        outcomeMetricId: checkInValues.outcomeMetricId,
        name: outcomeMetrics.name,
        inputType: outcomeMetrics.inputType,
        unit: outcomeMetrics.unit,
        sortOrder: outcomeMetrics.sortOrder,
        rating: checkInValues.ratingValue,
        boolean: checkInValues.booleanValue,
        numeric: checkInValues.numericValue,
      })
      .from(checkInValues)
      .innerJoin(checkIns, eq(checkInValues.checkInId, checkIns.id))
      .innerJoin(outcomeMetrics, eq(checkInValues.outcomeMetricId, outcomeMetrics.id))
      .where(eq(checkInValues.userId, userId)),
    db
      .select({ localDate: checkIns.localDate, name: tags.name })
      .from(checkInTags)
      .innerJoin(checkIns, eq(checkInTags.checkInId, checkIns.id))
      .innerJoin(tags, eq(checkInTags.tagId, tags.id))
      .where(eq(checkIns.userId, userId)),
  ]);

  const dates = new Set<string>();

  const behaviorCount = new Map<string, number>();
  for (const row of entryRows) {
    if (row.booleanValue == null && row.numericValue == null) continue;
    dates.add(row.entryDate);
    behaviorCount.set(row.entryDate, (behaviorCount.get(row.entryDate) ?? 0) + 1);
  }

  const checkInCount = new Map<string, number>();
  const latestNote = new Map<string, { at: Date; note: string }>();
  for (const row of checkInRows) {
    dates.add(row.localDate);
    checkInCount.set(row.localDate, (checkInCount.get(row.localDate) ?? 0) + 1);
    const note = row.note?.trim();
    if (note) {
      const current = latestNote.get(row.localDate);
      if (!current || row.occurredAt.getTime() > current.at.getTime()) {
        latestNote.set(row.localDate, { at: row.occurredAt, note });
      }
    }
  }

  type MetricBucket = {
    name: string;
    inputType: OutcomeInputType;
    unit: string | null;
    sortOrder: number;
    values: DayValue[];
  };
  const byDate = new Map<string, Map<string, MetricBucket>>();
  for (const row of valueRows) {
    let metrics = byDate.get(row.localDate);
    if (!metrics) {
      metrics = new Map();
      byDate.set(row.localDate, metrics);
    }
    let bucket = metrics.get(row.outcomeMetricId);
    if (!bucket) {
      bucket = {
        name: row.name,
        inputType: row.inputType,
        unit: row.unit,
        sortOrder: row.sortOrder,
        values: [],
      };
      metrics.set(row.outcomeMetricId, bucket);
    }
    bucket.values.push({
      occurredAt: row.occurredAt,
      rating: row.rating,
      boolean: row.boolean,
      numeric: row.numeric,
    });
  }

  const tagsByDate = new Map<string, Set<string>>();
  for (const row of tagRows) {
    let set = tagsByDate.get(row.localDate);
    if (!set) {
      set = new Set();
      tagsByDate.set(row.localDate, set);
    }
    set.add(row.name);
  }

  return [...dates]
    .sort((a, b) => (a < b ? 1 : -1)) // ISO strings sort chronologically; reverse for newest-first
    .map((date) => {
      const metrics = byDate.get(date);
      const outcomes: (HistoryOutcomeSummary & { sortOrder: number })[] = [];
      if (metrics) {
        for (const [outcomeMetricId, bucket] of metrics) {
          const value = summarizeOutcome(bucket.inputType, bucket.unit, bucket.values);
          if (value != null) {
            outcomes.push({
              outcomeMetricId,
              name: bucket.name,
              value,
              sortOrder: bucket.sortOrder,
            });
          }
        }
        outcomes.sort((a, b) => a.sortOrder - b.sortOrder);
      }
      return {
        date,
        behaviorCount: behaviorCount.get(date) ?? 0,
        checkInCount: checkInCount.get(date) ?? 0,
        outcomes: outcomes.map((o) => ({
          outcomeMetricId: o.outcomeMetricId,
          name: o.name,
          value: o.value,
        })),
        tags: [...(tagsByDate.get(date) ?? [])].sort((a, b) => a.localeCompare(b)),
        notePreview: latestNote.get(date)?.note ?? null,
      };
    });
}

// ---------------------------------------------------------------------------
// Day detail (PRD 15.2)
// ---------------------------------------------------------------------------

export type DayBehavior = {
  behavior: {
    id: string;
    name: string;
    inputType: BehaviorInputType;
    unit: string | null;
    isActive: boolean;
  };
  archivedAt: Date | null;
  booleanValue: boolean | null;
  numericValue: number | null;
  hasEntry: boolean;
};

export type DayCheckInValue = {
  outcomeMetricId: string;
  name: string;
  inputType: OutcomeInputType;
  unit: string | null;
  isActive: boolean;
  archivedAt: Date | null;
  rating: number | null;
  boolean: boolean | null;
  numeric: number | null;
};

export type DayCheckIn = {
  id: string;
  occurredAt: Date;
  note: string | null;
  values: DayCheckInValue[];
  tags: string[];
};

export type DayDetail = {
  date: string;
  activeBehaviors: DayBehavior[];
  archivedBehaviors: DayBehavior[];
  checkIns: DayCheckIn[];
};

/**
 * A single day for review and editing. Active behaviors always appear (so gaps are
 * fillable); archived behaviors appear only where they hold a recorded value that day.
 * Check-ins come in chronological order with values (including archived outcomes) and
 * tags. Owner-scoped throughout.
 */
export async function getDayDetail(date: string): Promise<DayDetail> {
  const userId = await requireUserId();

  const [allBehaviors, entryRows, dayCheckIns] = await Promise.all([
    db
      .select()
      .from(behaviors)
      .where(eq(behaviors.userId, userId))
      .orderBy(asc(behaviors.sortOrder), asc(behaviors.createdAt)),
    db
      .select()
      .from(dailyBehaviorEntries)
      .where(
        and(
          eq(dailyBehaviorEntries.userId, userId),
          eq(dailyBehaviorEntries.entryDate, date),
        ),
      ),
    db
      .select()
      .from(checkIns)
      .where(and(eq(checkIns.userId, userId), eq(checkIns.localDate, date)))
      .orderBy(asc(checkIns.occurredAt)),
  ]);

  const entryByBehavior = new Map(entryRows.map((row) => [row.behaviorId, row]));

  const toDayBehavior = (b: (typeof allBehaviors)[number]): DayBehavior => {
    const entry = entryByBehavior.get(b.id);
    return {
      behavior: {
        id: b.id,
        name: b.name,
        inputType: b.inputType,
        unit: b.unit,
        isActive: b.isActive,
      },
      archivedAt: b.archivedAt,
      booleanValue: entry?.booleanValue ?? null,
      numericValue: entry?.numericValue ?? null,
      hasEntry: entry != null,
    };
  };

  const activeBehaviors = allBehaviors
    .filter((b) => b.isActive)
    .map(toDayBehavior);
  const archivedBehaviors = allBehaviors
    .filter((b) => !b.isActive && entryByBehavior.has(b.id))
    .map(toDayBehavior);

  const ids = dayCheckIns.map((c) => c.id);
  const valuesByCheckIn = new Map<string, DayCheckInValue[]>();
  const tagsByCheckIn = new Map<string, string[]>();

  if (ids.length > 0) {
    const valueRows = await db
      .select({
        checkInId: checkInValues.checkInId,
        outcomeMetricId: checkInValues.outcomeMetricId,
        name: outcomeMetrics.name,
        inputType: outcomeMetrics.inputType,
        unit: outcomeMetrics.unit,
        isActive: outcomeMetrics.isActive,
        archivedAt: outcomeMetrics.archivedAt,
        rating: checkInValues.ratingValue,
        boolean: checkInValues.booleanValue,
        numeric: checkInValues.numericValue,
      })
      .from(checkInValues)
      .innerJoin(outcomeMetrics, eq(checkInValues.outcomeMetricId, outcomeMetrics.id))
      .where(
        and(
          eq(checkInValues.userId, userId),
          inArray(checkInValues.checkInId, ids),
        ),
      )
      .orderBy(asc(outcomeMetrics.sortOrder), asc(outcomeMetrics.createdAt));

    for (const row of valueRows) {
      const list = valuesByCheckIn.get(row.checkInId) ?? [];
      list.push({
        outcomeMetricId: row.outcomeMetricId,
        name: row.name,
        inputType: row.inputType,
        unit: row.unit,
        isActive: row.isActive,
        archivedAt: row.archivedAt,
        rating: row.rating,
        boolean: row.boolean,
        numeric: row.numeric,
      });
      valuesByCheckIn.set(row.checkInId, list);
    }

    const tagRows = await db
      .select({ checkInId: checkInTags.checkInId, name: tags.name })
      .from(checkInTags)
      .innerJoin(tags, eq(checkInTags.tagId, tags.id))
      .where(inArray(checkInTags.checkInId, ids))
      .orderBy(asc(tags.name));

    for (const row of tagRows) {
      const list = tagsByCheckIn.get(row.checkInId) ?? [];
      list.push(row.name);
      tagsByCheckIn.set(row.checkInId, list);
    }
  }

  const checkInsDetail: DayCheckIn[] = dayCheckIns.map((c) => ({
    id: c.id,
    occurredAt: c.occurredAt,
    note: c.note,
    values: valuesByCheckIn.get(c.id) ?? [],
    tags: tagsByCheckIn.get(c.id) ?? [],
  }));

  return { date, activeBehaviors, archivedBehaviors, checkIns: checkInsDetail };
}

// ---------------------------------------------------------------------------
// Delete a check-in (PRD 15.3)
// ---------------------------------------------------------------------------

/**
 * Deletes one check-in the current user owns. Its values and tag links cascade
 * (foreign keys with ON DELETE CASCADE), so nothing is left orphaned and it never
 * resurfaces. Returns false if the id was not found for this user.
 */
export async function deleteCheckIn(id: string): Promise<boolean> {
  const userId = await requireUserId();
  const removed = await db
    .delete(checkIns)
    .where(and(eq(checkIns.id, id), eq(checkIns.userId, userId)))
    .returning({ id: checkIns.id });
  return removed.length > 0;
}
