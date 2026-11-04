import { and, eq, gt, inArray, isNull, lt } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import {
  behaviorCategories,
  behaviors,
  checkIns,
  checkInTags,
  checkInValues,
  outcomeMetrics,
  tags,
  undoEntries,
  type UndoKind,
} from "@/db/schema";
import { countOutcomeAnswersForUser, getOutcomeForUser } from "./outcome-operations";

/**
 * Deletes that can be undone. Each delete runs at once, in one atomic batch that also
 * stores what it removed as an undo entry. The toast's Undo hands the entry id back and
 * `undoForUser` puts everything back exactly: the same ids, values and links. Entries live
 * for UNDO_WINDOW_MS (longer than the toast, to allow for a slow network), only their
 * owner can use them, and expired ones are purged on every delete, undo and reminder run,
 * so a delete becomes final shortly after the toast is gone.
 *
 * Session-free on purpose (see ./outcome-operations) so integration tests can run it.
 */

type AppDatabase = (typeof import("@/db"))["db"];
type Statement = BatchItem<"sqlite">;

export const UNDO_WINDOW_MS = 60_000;

type CheckInRow = typeof checkIns.$inferSelect;
type ValueRow = typeof checkInValues.$inferSelect;
type OutcomeRow = typeof outcomeMetrics.$inferSelect;
type TagRow = typeof tags.$inferSelect;
type CategoryRow = typeof behaviorCategories.$inferSelect;

type Payload =
  | { kind: "check_in"; checkIn: CheckInRow; values: ValueRow[]; tagIds: string[] }
  | {
      kind: "feeling";
      mode: "kept-answers";
      id: string;
      before: { isActive: boolean; archivedAt: Date | null };
    }
  | { kind: "feeling"; mode: "erased"; row: OutcomeRow; values: ValueRow[] }
  | { kind: "tag"; tag: TagRow; checkInIds: string[] }
  | { kind: "category"; category: CategoryRow; behaviorIds: string[] };

// Dates survive the JSON round trip as tagged strings and come back as Dates.
function serialize(payload: Payload): string {
  return JSON.stringify(payload, function (key, value) {
    const raw = (this as Record<string, unknown>)[key];
    return raw instanceof Date ? { $date: raw.getTime() } : value;
  });
}
function deserialize(text: string): Payload {
  return JSON.parse(text, (_key, value) =>
    value && typeof value === "object" && typeof value.$date === "number" ? new Date(value.$date) : value,
  ) as Payload;
}

/** Removes every expired undo entry, for every user: after that, deletes are final. */
export function purgeExpiredUndo(database: AppDatabase, now = new Date()) {
  return database.delete(undoEntries).where(lt(undoEntries.expiresAt, now));
}

function undoEntry(database: AppDatabase, userId: string, payload: Payload, now: Date) {
  const id = crypto.randomUUID();
  const insert = database.insert(undoEntries).values({
    id,
    userId,
    kind: payload.kind,
    payload: serialize(payload),
    expiresAt: new Date(now.getTime() + UNDO_WINDOW_MS),
    createdAt: now,
  });
  return { id, insert };
}

async function commit(
  database: AppDatabase,
  userId: string,
  payload: Payload,
  statements: Statement[],
): Promise<string> {
  const now = new Date();
  const entry = undoEntry(database, userId, payload, now);
  await database.batch([purgeExpiredUndo(database, now), entry.insert, ...statements]);
  return entry.id;
}

export type UndoableDelete = { undoId: string } | null;

/** Deletes a check-in with its answers and tag links. */
export async function deleteCheckInWithUndo(
  database: AppDatabase,
  userId: string,
  id: string,
): Promise<UndoableDelete> {
  const [checkIn] = await database
    .select()
    .from(checkIns)
    .where(and(eq(checkIns.id, id), eq(checkIns.userId, userId)))
    .limit(1);
  if (!checkIn) return null;
  const [values, links] = await Promise.all([
    database.select().from(checkInValues).where(and(eq(checkInValues.checkInId, id), eq(checkInValues.userId, userId))),
    database.select({ tagId: checkInTags.tagId }).from(checkInTags).where(eq(checkInTags.checkInId, id)),
  ]);
  const undoId = await commit(
    database,
    userId,
    { kind: "check_in", checkIn, values, tagIds: links.map((link) => link.tagId) },
    [
      database.delete(checkInValues).where(eq(checkInValues.checkInId, id)),
      database.delete(checkInTags).where(eq(checkInTags.checkInId, id)),
      database.delete(checkIns).where(and(eq(checkIns.id, id), eq(checkIns.userId, userId))),
    ],
  );
  return { undoId };
}

/**
 * Deletes a feeling. Its past answers stay on their check-ins (it is only marked deleted)
 * unless `eraseAnswers` is set or it has none, in which case the row and its answers go.
 */
export async function deleteOutcomeWithUndo(
  database: AppDatabase,
  userId: string,
  id: string,
  { eraseAnswers = false }: { eraseAnswers?: boolean } = {},
): Promise<(UndoableDelete & { erased: boolean }) | null> {
  const row = await getOutcomeForUser(database, userId, id);
  if (!row) return null;
  const answers = await countOutcomeAnswersForUser(database, userId, id);
  const owned = and(eq(outcomeMetrics.id, id), eq(outcomeMetrics.userId, userId), isNull(outcomeMetrics.deletedAt));

  if (eraseAnswers || answers === 0) {
    const values = await database
      .select()
      .from(checkInValues)
      .where(and(eq(checkInValues.outcomeMetricId, id), eq(checkInValues.userId, userId)));
    const undoId = await commit(database, userId, { kind: "feeling", mode: "erased", row, values }, [
      database.delete(checkInValues).where(and(eq(checkInValues.outcomeMetricId, id), eq(checkInValues.userId, userId))),
      database.delete(outcomeMetrics).where(owned),
    ]);
    return { undoId, erased: true };
  }

  const now = new Date();
  const undoId = await commit(
    database,
    userId,
    { kind: "feeling", mode: "kept-answers", id, before: { isActive: row.isActive, archivedAt: row.archivedAt } },
    [
      database
        .update(outcomeMetrics)
        .set({ isActive: false, archivedAt: row.archivedAt ?? now, deletedAt: now, updatedAt: now })
        .where(owned),
    ],
  );
  return { undoId, erased: false };
}

/** Deletes a tag; check-ins lose the tag, nothing else. */
export async function deleteTagWithUndo(
  database: AppDatabase,
  userId: string,
  id: string,
): Promise<UndoableDelete> {
  const [tag] = await database
    .select()
    .from(tags)
    .where(and(eq(tags.id, id), eq(tags.userId, userId)))
    .limit(1);
  if (!tag) return null;
  const links = await database.select({ checkInId: checkInTags.checkInId }).from(checkInTags).where(eq(checkInTags.tagId, id));
  const undoId = await commit(
    database,
    userId,
    { kind: "tag", tag, checkInIds: links.map((link) => link.checkInId) },
    [
      database.delete(checkInTags).where(eq(checkInTags.tagId, id)),
      database.delete(tags).where(and(eq(tags.id, id), eq(tags.userId, userId))),
    ],
  );
  return { undoId };
}

/** Deletes a behavior category; its behaviors become uncategorized. */
export async function deleteCategoryWithUndo(
  database: AppDatabase,
  userId: string,
  id: string,
): Promise<UndoableDelete> {
  const [category] = await database
    .select()
    .from(behaviorCategories)
    .where(and(eq(behaviorCategories.id, id), eq(behaviorCategories.userId, userId)))
    .limit(1);
  if (!category) return null;
  const members = await database
    .select({ id: behaviors.id })
    .from(behaviors)
    .where(and(eq(behaviors.categoryId, id), eq(behaviors.userId, userId)));
  const undoId = await commit(
    database,
    userId,
    { kind: "category", category, behaviorIds: members.map((member) => member.id) },
    [
      database
        .update(behaviors)
        .set({ categoryId: null })
        .where(and(eq(behaviors.categoryId, id), eq(behaviors.userId, userId))),
      database
        .delete(behaviorCategories)
        .where(and(eq(behaviorCategories.id, id), eq(behaviorCategories.userId, userId))),
    ],
  );
  return { undoId };
}

// Of `ids`, the ones that still exist and belong to the user.
async function ownedIds(
  database: AppDatabase,
  userId: string,
  table: typeof checkIns | typeof outcomeMetrics | typeof tags | typeof behaviors,
  ids: string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await database
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.userId, userId), inArray(table.id, ids)));
  return new Set(rows.map((row) => row.id));
}

async function restoreStatements(database: AppDatabase, userId: string, payload: Payload): Promise<Statement[]> {
  switch (payload.kind) {
    case "check_in": {
      // Answers for feelings erased since, and tags deleted since, can't come back.
      const feelings = await ownedIds(database, userId, outcomeMetrics, payload.values.map((v) => v.outcomeMetricId));
      const liveTags = await ownedIds(database, userId, tags, payload.tagIds);
      const values = payload.values.filter((value) => feelings.has(value.outcomeMetricId));
      const tagIds = payload.tagIds.filter((tagId) => liveTags.has(tagId));
      return [
        database.insert(checkIns).values({ ...payload.checkIn, userId }),
        ...(values.length > 0 ? [database.insert(checkInValues).values(values.map((value) => ({ ...value, userId })))] : []),
        ...(tagIds.length > 0
          ? [database.insert(checkInTags).values(tagIds.map((tagId) => ({ checkInId: payload.checkIn.id, tagId })))]
          : []),
      ];
    }
    case "feeling": {
      if (payload.mode === "kept-answers") {
        return [
          database
            .update(outcomeMetrics)
            .set({ deletedAt: null, isActive: payload.before.isActive, archivedAt: payload.before.archivedAt, updatedAt: new Date() })
            .where(and(eq(outcomeMetrics.id, payload.id), eq(outcomeMetrics.userId, userId))),
        ];
      }
      const liveCheckIns = await ownedIds(database, userId, checkIns, payload.values.map((v) => v.checkInId));
      const values = payload.values.filter((value) => liveCheckIns.has(value.checkInId));
      return [
        database.insert(outcomeMetrics).values({ ...payload.row, userId }),
        ...(values.length > 0 ? [database.insert(checkInValues).values(values.map((value) => ({ ...value, userId })))] : []),
      ];
    }
    case "tag": {
      // If a tag with that name was made again meanwhile, its check-ins go back to that one.
      const [sameName] = await database
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.userId, userId), eq(tags.name, payload.tag.name)))
        .limit(1);
      const tagId = sameName?.id ?? payload.tag.id;
      const liveCheckIns = await ownedIds(database, userId, checkIns, payload.checkInIds);
      const checkInIds = payload.checkInIds.filter((id) => liveCheckIns.has(id));
      return [
        ...(sameName ? [] : [database.insert(tags).values({ ...payload.tag, userId })]),
        ...(checkInIds.length > 0
          ? [database.insert(checkInTags).values(checkInIds.map((checkInId) => ({ checkInId, tagId }))).onConflictDoNothing()]
          : []),
      ];
    }
    case "category": {
      const [sameName] = await database
        .select({ id: behaviorCategories.id })
        .from(behaviorCategories)
        .where(and(eq(behaviorCategories.userId, userId), eq(behaviorCategories.normalizedName, payload.category.normalizedName)))
        .limit(1);
      const categoryId = sameName?.id ?? payload.category.id;
      const live = await ownedIds(database, userId, behaviors, payload.behaviorIds);
      const behaviorIds = payload.behaviorIds.filter((id) => live.has(id));
      return [
        ...(sameName ? [] : [database.insert(behaviorCategories).values({ ...payload.category, userId })]),
        // Only behaviors still uncategorized: one moved to another category since stays there.
        ...(behaviorIds.length > 0
          ? [
              database
                .update(behaviors)
                .set({ categoryId })
                .where(and(eq(behaviors.userId, userId), inArray(behaviors.id, behaviorIds), isNull(behaviors.categoryId))),
            ]
          : []),
      ];
    }
  }
}

/**
 * Puts back what an undoable delete removed. Returns the kind restored, or null when the
 * entry is unknown, someone else's, already used or expired.
 */
export async function undoForUser(
  database: AppDatabase,
  userId: string,
  undoId: string,
): Promise<UndoKind | null> {
  const now = new Date();
  const [entry] = await database
    .select()
    .from(undoEntries)
    .where(and(eq(undoEntries.id, undoId), eq(undoEntries.userId, userId), gt(undoEntries.expiresAt, now)))
    .limit(1);
  if (!entry) return null;
  const statements = await restoreStatements(database, userId, deserialize(entry.payload));
  await database.batch([
    database.delete(undoEntries).where(and(eq(undoEntries.id, undoId), eq(undoEntries.userId, userId))),
    ...statements,
    purgeExpiredUndo(database, now),
  ]);
  return entry.kind;
}
