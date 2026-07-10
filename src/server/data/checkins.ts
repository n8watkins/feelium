import "server-only";

import { and, asc, count, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  checkInTags,
  checkInValues,
  checkIns,
  outcomeMetrics,
  tags,
} from "@/db/schema";
import { requireUserId } from "./session";

export type CheckInValueInput = {
  outcomeMetricId: string;
  rating: number | null;
  boolean: boolean | null;
  numeric: number | null;
};

export type CheckInPayload = {
  localDate: string;
  note: string | null;
  values: CheckInValueInput[];
  tagIds: string[];
  newTagNames: string[];
};

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

// Keeps only answered values whose metric the user actually owns.
async function ownedAnsweredValues(userId: string, values: CheckInValueInput[]) {
  const answered = values.filter(
    (v) => v.rating != null || v.boolean != null || v.numeric != null,
  );
  if (answered.length === 0) return [];
  const ids = [...new Set(answered.map((v) => v.outcomeMetricId))];
  const owned = await db
    .select({ id: outcomeMetrics.id })
    .from(outcomeMetrics)
    .where(
      and(eq(outcomeMetrics.userId, userId), inArray(outcomeMetrics.id, ids)),
    );
  const ownedSet = new Set(owned.map((o) => o.id));
  return answered.filter((v) => ownedSet.has(v.outcomeMetricId));
}

// Resolves the final tag id set: owned existing ids plus newly-created (deduped) tags.
async function resolveTagIds(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  tagIds: string[],
  newTagNames: string[],
): Promise<string[]> {
  const result = new Set<string>();

  if (tagIds.length > 0) {
    const owned = await tx
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.userId, userId), inArray(tags.id, tagIds)));
    owned.forEach((t) => result.add(t.id));
  }

  const names = [...new Set(newTagNames.map((n) => n.trim()).filter(Boolean))];
  if (names.length > 0) {
    await tx
      .insert(tags)
      .values(names.map((name) => ({ userId, name })))
      .onConflictDoNothing({ target: [tags.userId, tags.name] });
    const rows = await tx
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.userId, userId), inArray(tags.name, names)));
    rows.forEach((t) => result.add(t.id));
  }

  return [...result];
}

export async function createCheckIn(payload: CheckInPayload): Promise<string> {
  const userId = await requireUserId();
  const values = await ownedAnsweredValues(userId, payload.values);

  return db.transaction(async (tx) => {
    const [checkIn] = await tx
      .insert(checkIns)
      .values({ userId, localDate: payload.localDate, note: payload.note })
      .returning({ id: checkIns.id });
    const checkInId = checkIn.id;

    if (values.length > 0) {
      await tx.insert(checkInValues).values(
        values.map((v) => ({
          userId,
          checkInId,
          outcomeMetricId: v.outcomeMetricId,
          ratingValue: v.rating,
          booleanValue: v.boolean,
          numericValue: v.numeric,
        })),
      );
    }

    const finalTagIds = await resolveTagIds(
      tx,
      userId,
      payload.tagIds,
      payload.newTagNames,
    );
    if (finalTagIds.length > 0) {
      await tx
        .insert(checkInTags)
        .values(finalTagIds.map((tagId) => ({ checkInId, tagId })));
    }

    return checkInId;
  });
}

/** Replaces a check-in's note, values, and tags. Owner-scoped. */
export async function updateCheckIn(
  id: string,
  payload: CheckInPayload,
): Promise<boolean> {
  const userId = await requireUserId();
  const [existing] = await db
    .select({ id: checkIns.id })
    .from(checkIns)
    .where(and(eq(checkIns.id, id), eq(checkIns.userId, userId)))
    .limit(1);
  if (!existing) return false;

  const values = await ownedAnsweredValues(userId, payload.values);

  await db.transaction(async (tx) => {
    await tx
      .update(checkIns)
      .set({ note: payload.note })
      .where(and(eq(checkIns.id, id), eq(checkIns.userId, userId)));

    await tx.delete(checkInValues).where(eq(checkInValues.checkInId, id));
    if (values.length > 0) {
      await tx.insert(checkInValues).values(
        values.map((v) => ({
          userId,
          checkInId: id,
          outcomeMetricId: v.outcomeMetricId,
          ratingValue: v.rating,
          booleanValue: v.boolean,
          numericValue: v.numeric,
        })),
      );
    }

    await tx.delete(checkInTags).where(eq(checkInTags.checkInId, id));
    const finalTagIds = await resolveTagIds(
      tx,
      userId,
      payload.tagIds,
      payload.newTagNames,
    );
    if (finalTagIds.length > 0) {
      await tx
        .insert(checkInTags)
        .values(finalTagIds.map((tagId) => ({ checkInId: id, tagId })));
    }
  });

  return true;
}
