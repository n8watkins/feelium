import "server-only";

import { and, eq, gte, lte } from "drizzle-orm";

import { db } from "@/db";
import {
  behaviors,
  checkInValues,
  checkIns,
  dailyBehaviorEntries,
  outcomeMetrics,
} from "@/db/schema";
import { addDaysISO, todayISO } from "@/lib/date";
import {
  computeInsights,
  TIME_RANGES,
  type BehaviorEntryRow,
  type BehaviorMeta,
  type InsightsData,
  type OutcomeMeta,
  type OutcomeValueRow,
  type TimeRange,
} from "@/lib/analytics";
import { requireUserId } from "./session";
import { getCurrentProfile } from "./profile";

/**
 * Loads everything the Insights tab needs for one time range (PRD 16) and hands it to the
 * pure analytics engine. All rows are owner-scoped; both active and archived metrics are
 * fetched so archived-but-historical data still appears (PRD 16.6). Fixed ranges are
 * bounded in SQL so query and transfer costs do not grow with the user's full history.
 */
export async function getInsights(range: TimeRange): Promise<InsightsData> {
  const userId = await requireUserId();
  const profile = await getCurrentProfile();
  const today = todayISO(profile?.timezone);
  const rangeDays = TIME_RANGES.find((item) => item.value === range)?.days ?? null;
  const startDate = rangeDays == null ? null : addDaysISO(today, -(rangeDays - 1));

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
      .where(
        and(
          eq(dailyBehaviorEntries.userId, userId),
          lte(dailyBehaviorEntries.entryDate, today),
          startDate ? gte(dailyBehaviorEntries.entryDate, startDate) : undefined,
        ),
      ),
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
      .where(
        and(
          eq(checkInValues.userId, userId),
          eq(checkIns.userId, userId),
          lte(checkIns.localDate, today),
          startDate ? gte(checkIns.localDate, startDate) : undefined,
        ),
      ),
  ]);

  const behaviorMeta: BehaviorMeta[] = [...behaviorRows]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((r) => ({
      id: r.id,
      name: r.name,
      inputType: r.inputType,
      desiredDirection: r.desiredDirection,
      unit: r.unit,
      isActive: r.isActive,
    }));

  const outcomeMeta: OutcomeMeta[] = [...outcomeRows]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((r) => ({
      id: r.id,
      name: r.name,
      inputType: r.inputType,
      desiredDirection: r.desiredDirection,
      unit: r.unit,
      isActive: r.isActive,
    }));

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
    today,
    behaviors: behaviorMeta,
    outcomes: outcomeMeta,
    entries,
    values,
  });
}
