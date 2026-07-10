import "server-only";

import { and, asc, count, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { checkInTags, checkInValues, checkIns, outcomeMetrics } from "@/db/schema";
import {
  createCheckInForUser,
  updateCheckInForUser,
  type CheckInPayload,
} from "./checkin-writes";
import { requireUserId } from "./session";

export type { CheckInPayload, CheckInValueInput } from "./checkin-writes";

/** Count of check-ins the current user recorded on a given local calendar date. */
export async function countCheckInsForDate(localDate: string): Promise<number> {
  const userId = await requireUserId();
  const [row] = await db
    .select({ value: count() })
    .from(checkIns)
    .where(and(eq(checkIns.userId, userId), eq(checkIns.localDate, localDate)));
  return row?.value ?? 0;
}

/** The user's most recent check-in with its values joined to metric metadata. */
export async function getLatestCheckIn() {
  const userId = await requireUserId();
  const [checkIn] = await db
    .select()
    .from(checkIns)
    .where(eq(checkIns.userId, userId))
    .orderBy(desc(checkIns.occurredAt))
    .limit(1);
  if (!checkIn) return null;

  const values = await db
    .select({
      outcomeMetricId: checkInValues.outcomeMetricId,
      name: outcomeMetrics.name,
      inputType: outcomeMetrics.inputType,
      unit: outcomeMetrics.unit,
      rating: checkInValues.ratingValue,
      boolean: checkInValues.booleanValue,
      numeric: checkInValues.numericValue,
    })
    .from(checkInValues)
    .innerJoin(
      outcomeMetrics,
      eq(checkInValues.outcomeMetricId, outcomeMetrics.id),
    )
    .where(eq(checkInValues.checkInId, checkIn.id))
    .orderBy(asc(outcomeMetrics.sortOrder));

  return { checkIn, values };
}

/** A single check-in with its raw values and tag ids, for editing. Owner-scoped. */
export async function getCheckInDetail(id: string) {
  const userId = await requireUserId();
  const [checkIn] = await db
    .select()
    .from(checkIns)
    .where(and(eq(checkIns.id, id), eq(checkIns.userId, userId)))
    .limit(1);
  if (!checkIn) return null;

  const values = await db
    .select()
    .from(checkInValues)
    .where(eq(checkInValues.checkInId, id));
  const tagRows = await db
    .select({ tagId: checkInTags.tagId })
    .from(checkInTags)
    .where(eq(checkInTags.checkInId, id));

  return { checkIn, values, tagIds: tagRows.map((t) => t.tagId) };
}

/**
 * Creates a check-in for the current session user. The write itself lives in
 * ./checkin-writes (session-free, so it is integration-tested directly against a Turso
 * target) and uses `db.batch()` rather than an interactive transaction - see that module
 * for why that matters on libSQL/Turso over HTTP.
 */
export async function createCheckIn(payload: CheckInPayload): Promise<string> {
  const userId = await requireUserId();
  return createCheckInForUser(db, userId, payload);
}

/** Replaces a check-in's note, values, and tags for the current session user. */
export async function updateCheckIn(
  id: string,
  payload: CheckInPayload,
): Promise<boolean> {
  const userId = await requireUserId();
  return updateCheckInForUser(db, userId, id, payload);
}
