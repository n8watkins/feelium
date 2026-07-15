import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { behaviors, dailyBehaviorEntries } from "@/db/schema";
import { requireUserId } from "./session";

const CONFLICT_TARGET = [
  dailyBehaviorEntries.userId,
  dailyBehaviorEntries.behaviorId,
  dailyBehaviorEntries.entryDate,
] as const;

async function assertOwnsBehavior(userId: string, behaviorId: string) {
  const [row] = await db
    .select({ id: behaviors.id, inputType: behaviors.inputType })
    .from(behaviors)
    .where(and(eq(behaviors.id, behaviorId), eq(behaviors.userId, userId)))
    .limit(1);
  if (!row) throw new Error("NOT_FOUND");
  return row;
}

/** The current daily entries for the user on a given date, keyed by behavior id. */
export async function getEntriesForDate(entryDate: string) {
  const userId = await requireUserId();
  const rows = await db
    .select()
    .from(dailyBehaviorEntries)
    .where(
      and(
        eq(dailyBehaviorEntries.userId, userId),
        eq(dailyBehaviorEntries.entryDate, entryDate),
      ),
    );
  return new Map(rows.map((row) => [row.behaviorId, row]));
}

/**
 * Records the current yes/no value for a behavior on a date. Upserts one row per
 * (user, behavior, date); the other value column is cleared so an explicit No stays
 * distinct from a numeric value. updatedAt is bumped automatically by $onUpdate.
 */
export async function setBehaviorBoolean(
  behaviorId: string,
  value: boolean,
  entryDate: string,
) {
  const userId = await requireUserId();
  const behavior = await assertOwnsBehavior(userId, behaviorId);
  if (behavior.inputType !== "boolean") throw new Error("INVALID_VALUE_TYPE");
  await db
    .insert(dailyBehaviorEntries)
    .values({ userId, behaviorId, entryDate, booleanValue: value, numericValue: null })
    .onConflictDoUpdate({
      target: [...CONFLICT_TARGET],
      set: { booleanValue: value, numericValue: null },
    });
}

/** Records the current numeric value (0 is valid) for a behavior on a date. */
export async function setBehaviorNumeric(
  behaviorId: string,
  value: number,
  entryDate: string,
) {
  const userId = await requireUserId();
  const behavior = await assertOwnsBehavior(userId, behaviorId);
  if (behavior.inputType !== "numeric") throw new Error("INVALID_VALUE_TYPE");
  await db
    .insert(dailyBehaviorEntries)
    .values({ userId, behaviorId, entryDate, numericValue: value, booleanValue: null })
    .onConflictDoUpdate({
      target: [...CONFLICT_TARGET],
      set: { numericValue: value, booleanValue: null },
    });
}

/** Removes the day's entry entirely, returning the behavior to "unknown" (no entry). */
export async function clearBehaviorEntry(behaviorId: string, entryDate: string) {
  const userId = await requireUserId();
  await db
    .delete(dailyBehaviorEntries)
    .where(
      and(
        eq(dailyBehaviorEntries.userId, userId),
        eq(dailyBehaviorEntries.behaviorId, behaviorId),
        eq(dailyBehaviorEntries.entryDate, entryDate),
      ),
    );
}
