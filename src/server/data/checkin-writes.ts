import type { BatchItem } from "drizzle-orm/batch";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { and, eq, inArray } from "drizzle-orm";

import * as schema from "@/db/schema";
import {
  checkInTags,
  checkInValues,
  checkIns,
  outcomeMetrics,
  tags,
} from "@/db/schema";

/**
 * Session-free check-in write logic, kept separate from ./checkins so it can be exercised
 * directly by integration tests against a scratch libSQL/Turso target (this module imports
 * neither `server-only` nor the auth session, which would fail outside the Next runtime).
 *
 * The writes use `db.batch()`, never an interactive `db.transaction()`: over libSQL/Turso
 * HTTP an interactive transaction is multiple round-trips (BEGIN / writes / COMMIT) whose
 * connection is not guaranteed to be sticky in a serverless runtime, so the COMMIT can be
 * dropped and the whole write silently rolls back - the "check-in appears to save but
 * nothing persists" bug. A batch is one request the server commits atomically.
 */

// The libSQL/Drizzle database handle, passed in so tests can supply a scratch target.
export type Database = LibSQLDatabase<typeof schema>;
type Statement = BatchItem<"sqlite">;

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

// Keeps only answered values whose metric the user actually owns.
async function ownedAnsweredValues(
  database: Database,
  userId: string,
  values: CheckInValueInput[],
) {
  const answered = values.filter(
    (v) => v.rating != null || v.boolean != null || v.numeric != null,
  );
  if (answered.length === 0) return [];
  const ids = [...new Set(answered.map((v) => v.outcomeMetricId))];
  const owned = await database
    .select({ id: outcomeMetrics.id, inputType: outcomeMetrics.inputType })
    .from(outcomeMetrics)
    .where(
      and(eq(outcomeMetrics.userId, userId), inArray(outcomeMetrics.id, ids)),
    );
  const ownedTypes = new Map(owned.map((outcome) => [outcome.id, outcome.inputType]));
  return answered.filter((value) => {
    const inputType = ownedTypes.get(value.outcomeMetricId);
    if (!inputType) return false;
    const matches =
      (inputType === "rating" && value.rating != null && value.boolean == null && value.numeric == null) ||
      (inputType === "boolean" && value.rating == null && value.boolean != null && value.numeric == null) ||
      (inputType === "numeric" && value.rating == null && value.boolean == null && value.numeric != null);
    if (!matches) throw new Error("INVALID_VALUE_TYPE");
    return true;
  });
}

// Resolves the final tag id set: owned existing ids plus newly-created (deduped) tags.
//
// Tag creation happens here, ahead of the atomic batch that writes the check-in, because
// it needs a read-after-write (insert new names, then read back their ids). Doing it up
// front keeps the check-in write itself a single-round-trip batch.
async function resolveTagIds(
  database: Database,
  userId: string,
  tagIds: string[],
  newTagNames: string[],
): Promise<string[]> {
  const result = new Set<string>();

  if (tagIds.length > 0) {
    const owned = await database
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.userId, userId), inArray(tags.id, tagIds)));
    owned.forEach((t) => result.add(t.id));
  }

  const names = [...new Set(newTagNames.map((n) => n.trim()).filter(Boolean))];
  if (names.length > 0) {
    await database
      .insert(tags)
      .values(names.map((name) => ({ userId, name })))
      .onConflictDoNothing({ target: [tags.userId, tags.name] });
    const rows = await database
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.userId, userId), inArray(tags.name, names)));
    rows.forEach((t) => result.add(t.id));
  }

  return [...result];
}

/**
 * Writes a new check-in with its values + tag links as one atomic `db.batch()`. The id is
 * generated client-side so the value/tag-link rows can reference it without a `.returning()`
 * round-trip. Returns the new check-in id.
 */
export async function createCheckInForUser(
  database: Database,
  userId: string,
  payload: CheckInPayload,
): Promise<string> {
  const values = await ownedAnsweredValues(database, userId, payload.values);
  const finalTagIds = await resolveTagIds(
    database,
    userId,
    payload.tagIds,
    payload.newTagNames,
  );

  const checkInId = crypto.randomUUID();
  const statements: [Statement, ...Statement[]] = [
    database.insert(checkIns).values({
      id: checkInId,
      userId,
      localDate: payload.localDate,
      note: payload.note,
    }),
  ];
  if (values.length > 0) {
    statements.push(
      database.insert(checkInValues).values(
        values.map((v) => ({
          userId,
          checkInId,
          outcomeMetricId: v.outcomeMetricId,
          ratingValue: v.rating,
          booleanValue: v.boolean,
          numericValue: v.numeric,
        })),
      ),
    );
  }
  if (finalTagIds.length > 0) {
    statements.push(
      database
        .insert(checkInTags)
        .values(finalTagIds.map((tagId) => ({ checkInId, tagId }))),
    );
  }

  await database.batch(statements);
  return checkInId;
}

/**
 * Replaces a check-in's note, values, and tags in one atomic `db.batch()`. Returns false if
 * the check-in is not found for this user.
 */
export async function updateCheckInForUser(
  database: Database,
  userId: string,
  id: string,
  payload: CheckInPayload,
): Promise<boolean> {
  const [existing] = await database
    .select({ id: checkIns.id })
    .from(checkIns)
    .where(and(eq(checkIns.id, id), eq(checkIns.userId, userId)))
    .limit(1);
  if (!existing) return false;

  const values = await ownedAnsweredValues(database, userId, payload.values);
  const finalTagIds = await resolveTagIds(
    database,
    userId,
    payload.tagIds,
    payload.newTagNames,
  );

  // Rewrite note, then clear-and-reinsert values and tag links - all atomically.
  const statements: [Statement, ...Statement[]] = [
    database
      .update(checkIns)
      .set({ note: payload.note })
      .where(and(eq(checkIns.id, id), eq(checkIns.userId, userId))),
    database.delete(checkInValues).where(eq(checkInValues.checkInId, id)),
    database.delete(checkInTags).where(eq(checkInTags.checkInId, id)),
  ];
  if (values.length > 0) {
    statements.push(
      database.insert(checkInValues).values(
        values.map((v) => ({
          userId,
          checkInId: id,
          outcomeMetricId: v.outcomeMetricId,
          ratingValue: v.rating,
          booleanValue: v.boolean,
          numericValue: v.numeric,
        })),
      ),
    );
  }
  if (finalTagIds.length > 0) {
    statements.push(
      database
        .insert(checkInTags)
        .values(finalTagIds.map((tagId) => ({ checkInId: id, tagId }))),
    );
  }

  await database.batch(statements);
  return true;
}
