import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  behaviors,
  checkInValues,
  checkIns,
  dailyBehaviorEntries,
  outcomeMetrics,
} from "@/db/schema";
import { todayISO } from "@/lib/date";
import {
  computeInsights,
  type BehaviorEntryRow,
  type BehaviorMeta,
  type InsightsData,
  type OutcomeMeta,
  type OutcomeValueRow,
  type TimeRange,
} from "@/lib/analytics";
import { requireUserId } from "./session";

/**
 * Loads everything the Insights tab needs for one time range (PRD 16) and hands it to the
 * pure analytics engine. All rows are owner-scoped; both active and archived metrics are
 * fetched so archived-but-historical data still appears (PRD 16.6). The dataset for a
 * personal tracker is small, so we read the full history once and let the engine window
 * it - that also lets the "all time" range find the earliest recorded day.
 */
export async function getInsights(range: TimeRange): Promise<InsightsData> {
  const userId = await requireUserId();

  const [behaviorRows, outcomeRows, entryRows, valueRows] = await Promise.all([
    db
      .select({
        id: behaviors.id,
        name: behaviors.name,
        inputType: behaviors.inputType,
        desiredDirection: behaviors.desiredDirection,
        unit: behaviors.unit,
        isActive: behaviors.isActive,
        sortOrder: behaviors.sortOrder,
      })
      .from(behaviors)
      .where(eq(behaviors.userId, userId)),
    db
      .select({
        id: outcomeMetrics.id,
        name: outcomeMetrics.name,
        inputType: outcomeMetrics.inputType,
        desiredDirection: outcomeMetrics.desiredDirection,
        unit: outcomeMetrics.unit,
        isActive: outcomeMetrics.isActive,
        sortOrder: outcomeMetrics.sortOrder,
      })
      .from(outcomeMetrics)
      .where(eq(outcomeMetrics.userId, userId)),
    db
      .select({
        behaviorId: dailyBehaviorEntries.behaviorId,
        entryDate: dailyBehaviorEntries.entryDate,
        booleanValue: dailyBehaviorEntries.booleanValue,
        numericValue: dailyBehaviorEntries.numericValue,
      })
      .from(dailyBehaviorEntries)
      .where(eq(dailyBehaviorEntries.userId, userId)),
    db
      .select({
        outcomeMetricId: checkInValues.outcomeMetricId,
        localDate: checkIns.localDate,
        occurredAt: checkIns.occurredAt,
        rating: checkInValues.ratingValue,
        boolean: checkInValues.booleanValue,
        numeric: checkInValues.numericValue,
      })
      .from(checkInValues)
      .innerJoin(checkIns, eq(checkInValues.checkInId, checkIns.id))
      .where(eq(checkInValues.userId, userId)),
  ]);

  const behaviorMeta: BehaviorMeta[] = [...behaviorRows]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ sortOrder: _sortOrder, ...meta }) => meta);

  const outcomeMeta: OutcomeMeta[] = [...outcomeRows]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ sortOrder: _sortOrder, ...meta }) => meta);

  const entries: BehaviorEntryRow[] = entryRows.map((r) => ({
    behaviorId: r.behaviorId,
    entryDate: r.entryDate,
    booleanValue: r.booleanValue,
    numericValue: r.numericValue,
  }));

  const values: OutcomeValueRow[] = valueRows.map((r) => ({
    outcomeMetricId: r.outcomeMetricId,
    localDate: r.localDate,
    occurredAt: r.occurredAt.getTime(),
    rating: r.rating,
    boolean: r.boolean,
    numeric: r.numeric,
  }));

  return computeInsights({
    range,
    today: todayISO(),
    behaviors: behaviorMeta,
    outcomes: outcomeMeta,
    entries,
    values,
  });
}
