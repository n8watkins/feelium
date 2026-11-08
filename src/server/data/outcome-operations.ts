import { and, asc, count, eq, isNull } from "drizzle-orm";

import {
  checkInValues,
  outcomeMetrics,
  type OutcomeDirection,
  type OutcomeInputType,
} from "@/db/schema";
import { InputTypeLockedError } from "./errors";

/**
 * Session-free operations on a user's feelings (outcome metrics), so integration tests can
 * run them against a scratch database. `./outcomes` wraps each one with the session user.
 *
 * A feeling is in one of three states:
 * - active: asked in every check-in, in the order the user picked;
 * - archived: not asked any more, but listed in Settings and still in Insights, and can be
 *   brought back;
 * - deleted: gone from Settings, check-ins and Insights. Past check-ins keep the answers
 *   (deleting never rewrites history) unless the user chose to erase them too, which
 *   removes the row and every answer with it.
 */

type AppDatabase = (typeof import("@/db"))["db"];

export type OutcomeInput = {
  name: string;
  inputType: OutcomeInputType;
  desiredDirection: OutcomeDirection | null;
  unit: string | null;
  description: string | null;
};

const owned = (userId: string, id: string) =>
  and(eq(outcomeMetrics.id, id), eq(outcomeMetrics.userId, userId), isNull(outcomeMetrics.deletedAt));

/** Active and archived feelings, in the user's order; deleted ones are left out. */
export async function listOutcomesForUser(
  database: AppDatabase,
  userId: string,
  { includeDeleted = false }: { includeDeleted?: boolean } = {},
) {
  return database
    .select()
    .from(outcomeMetrics)
    .where(
      and(
        eq(outcomeMetrics.userId, userId),
        includeDeleted ? undefined : isNull(outcomeMetrics.deletedAt),
      ),
    )
    .orderBy(asc(outcomeMetrics.sortOrder), asc(outcomeMetrics.createdAt));
}

export async function listActiveOutcomesForUser(database: AppDatabase, userId: string) {
  return database
    .select()
    .from(outcomeMetrics)
    .where(
      and(
        eq(outcomeMetrics.userId, userId),
        eq(outcomeMetrics.isActive, true),
        isNull(outcomeMetrics.deletedAt),
      ),
    )
    .orderBy(asc(outcomeMetrics.sortOrder), asc(outcomeMetrics.createdAt));
}

export async function getOutcomeForUser(database: AppDatabase, userId: string, id: string) {
  const [row] = await database.select().from(outcomeMetrics).where(owned(userId, id)).limit(1);
  return row ?? null;
}

/** How many check-ins hold an answer for this feeling. */
export async function countOutcomeAnswersForUser(
  database: AppDatabase,
  userId: string,
  id: string,
): Promise<number> {
  const [row] = await database
    .select({ n: count() })
    .from(checkInValues)
    .where(and(eq(checkInValues.outcomeMetricId, id), eq(checkInValues.userId, userId)));
  return row?.n ?? 0;
}

/** Answer counts for every feeling of the user's that has any, keyed by feeling id. */
export async function countAnswersByOutcomeForUser(
  database: AppDatabase,
  userId: string,
): Promise<Map<string, number>> {
  const rows = await database
    .select({ id: checkInValues.outcomeMetricId, n: count() })
    .from(checkInValues)
    .where(eq(checkInValues.userId, userId))
    .groupBy(checkInValues.outcomeMetricId);
  return new Map(rows.map((row) => [row.id, row.n]));
}

// After every feeling, archived ones included, so an archived feeling keeps its own place
// and comes back to it when restored.
async function nextSortOrder(database: AppDatabase, userId: string): Promise<number> {
  const rows = await listOutcomesForUser(database, userId);
  return rows.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
}

export async function createOutcomeForUser(
  database: AppDatabase,
  userId: string,
  input: OutcomeInput,
) {
  const sortOrder = await nextSortOrder(database, userId);
  const [row] = await database
    .insert(outcomeMetrics)
    .values({ userId, sortOrder, ...input })
    .returning();
  return row;
}

/** Saves edits. The input type is locked once any answer exists (PRD 14.2). */
export async function updateOutcomeForUser(
  database: AppDatabase,
  userId: string,
  id: string,
  input: OutcomeInput,
) {
  const existing = await getOutcomeForUser(database, userId, id);
  if (!existing) throw new Error("NOT_FOUND");
  if (
    input.inputType !== existing.inputType &&
    (await countOutcomeAnswersForUser(database, userId, id)) > 0
  ) {
    throw new InputTypeLockedError();
  }
  await database
    .update(outcomeMetrics)
    .set({
      name: input.name,
      inputType: input.inputType,
      desiredDirection: input.desiredDirection,
      unit: input.unit,
      description: input.description,
      updatedAt: new Date(),
    })
    .where(owned(userId, id));
}

export async function archiveOutcomeForUser(database: AppDatabase, userId: string, id: string) {
  await database
    .update(outcomeMetrics)
    .set({ isActive: false, archivedAt: new Date(), updatedAt: new Date() })
    .where(owned(userId, id));
}

/** Brings an archived feeling back to the check-in, in the place it had. */
export async function reactivateOutcomeForUser(database: AppDatabase, userId: string, id: string) {
  await database
    .update(outcomeMetrics)
    .set({ isActive: true, archivedAt: null, updatedAt: new Date() })
    .where(and(owned(userId, id), eq(outcomeMetrics.isActive, false)));
}

/**
 * Moves an active feeling one place up or down the check-in, past its active neighbour.
 * Archived feelings keep their own slots in between, so a restored one returns where it
 * was. The whole order is rewritten as 0..n-1 in one batch, which also heals duplicate
 * sort values from older data.
 */
export async function moveOutcomeForUser(
  database: AppDatabase,
  userId: string,
  id: string,
  direction: "up" | "down",
) {
  const all = await listOutcomesForUser(database, userId);
  const index = all.findIndex((row) => row.id === id && row.isActive);
  if (index === -1) return;
  const step = direction === "up" ? -1 : 1;
  let swapIndex = index + step;
  while (swapIndex >= 0 && swapIndex < all.length && !all[swapIndex].isActive) swapIndex += step;
  if (swapIndex < 0 || swapIndex >= all.length) return;

  const order = all.map((row) => row.id);
  [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  const [first, ...rest] = order.map((rowId, sortOrder) =>
    database
      .update(outcomeMetrics)
      .set({ sortOrder })
      .where(and(eq(outcomeMetrics.id, rowId), eq(outcomeMetrics.userId, userId))),
  );
  await database.batch([first, ...rest]);
}
