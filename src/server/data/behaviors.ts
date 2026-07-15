import "server-only";

import { and, asc, count, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  behaviors,
  dailyBehaviorEntries,
  type BehaviorDirection,
  type BehaviorInputType,
} from "@/db/schema";
import { InputTypeLockedError } from "./errors";
import { requireUserId } from "./session";

export type BehaviorInput = {
  name: string;
  inputType: BehaviorInputType;
  desiredDirection: BehaviorDirection;
  unit: string | null;
  description: string | null;
  customPrompt: string | null;
};

/** All of the user's behaviors, active first, each group ordered by sort order. */
export async function listBehaviors() {
  const userId = await requireUserId();
  return db
    .select()
    .from(behaviors)
    .where(eq(behaviors.userId, userId))
    .orderBy(asc(behaviors.sortOrder), asc(behaviors.createdAt));
}

/** Active behaviors only, in sort order (used by the Today screen). */
export async function listActiveBehaviors() {
  const userId = await requireUserId();
  return db
    .select()
    .from(behaviors)
    .where(and(eq(behaviors.userId, userId), eq(behaviors.isActive, true)))
    .orderBy(asc(behaviors.sortOrder), asc(behaviors.createdAt));
}

export async function getBehavior(id: string) {
  const userId = await requireUserId();
  const [row] = await db
    .select()
    .from(behaviors)
    .where(and(eq(behaviors.id, id), eq(behaviors.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** True once any daily entry has been recorded for this behavior (input-type lock). */
export async function behaviorHasEntries(id: string): Promise<boolean> {
  const userId = await requireUserId();
  const [row] = await db
    .select({ n: count() })
    .from(dailyBehaviorEntries)
    .where(
      and(
        eq(dailyBehaviorEntries.behaviorId, id),
        eq(dailyBehaviorEntries.userId, userId),
      ),
    );
  return (row?.n ?? 0) > 0;
}

async function nextActiveSortOrder(userId: string): Promise<number> {
  const rows = await db
    .select({ sortOrder: behaviors.sortOrder })
    .from(behaviors)
    .where(and(eq(behaviors.userId, userId), eq(behaviors.isActive, true)));
  return rows.reduce((max, r) => Math.max(max, r.sortOrder), -1) + 1;
}

export async function createBehavior(input: BehaviorInput) {
  const userId = await requireUserId();
  const sortOrder = await nextActiveSortOrder(userId);
  const [row] = await db
    .insert(behaviors)
    .values({ userId, sortOrder, ...input })
    .returning();
  return row;
}

/**
 * Updates editable fields. The input type may only change while no entries exist
 * (PRD 14.2); otherwise this throws InputTypeLockedError.
 */
export async function updateBehavior(id: string, input: BehaviorInput) {
  const userId = await requireUserId();
  const existing = await getBehavior(id);
  if (!existing) throw new Error("NOT_FOUND");

  if (input.inputType !== existing.inputType && (await behaviorHasEntries(id))) {
    throw new InputTypeLockedError();
  }

  await db
    .update(behaviors)
    .set({
      name: input.name,
      inputType: input.inputType,
      desiredDirection: input.desiredDirection,
      unit: input.unit,
      description: input.description,
      customPrompt: input.customPrompt,
    })
    .where(and(eq(behaviors.id, id), eq(behaviors.userId, userId)));
}

/** Soft archive: removes from active tracking but preserves all history (PRD 13.2). */
export async function archiveBehavior(id: string) {
  const userId = await requireUserId();
  await db
    .update(behaviors)
    .set({ isActive: false, archivedAt: new Date() })
    .where(and(eq(behaviors.id, id), eq(behaviors.userId, userId)));
}

export async function reactivateBehavior(id: string) {
  const userId = await requireUserId();
  const sortOrder = await nextActiveSortOrder(userId);
  await db
    .update(behaviors)
    .set({ isActive: true, archivedAt: null, sortOrder })
    .where(and(eq(behaviors.id, id), eq(behaviors.userId, userId)));
}

/** Swaps sort order with the adjacent active behavior. */
export async function moveBehavior(id: string, direction: "up" | "down") {
  const userId = await requireUserId();
  const active = await db
    .select()
    .from(behaviors)
    .where(and(eq(behaviors.userId, userId), eq(behaviors.isActive, true)))
    .orderBy(asc(behaviors.sortOrder), asc(behaviors.createdAt));

  const index = active.findIndex((b) => b.id === id);
  if (index === -1) return;
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= active.length) return;

  const a = active[index];
  const b = active[swapIndex];
  await db.batch([
    db
      .update(behaviors)
      .set({ sortOrder: b.sortOrder })
      .where(and(eq(behaviors.id, a.id), eq(behaviors.userId, userId))),
    db
      .update(behaviors)
      .set({ sortOrder: a.sortOrder })
      .where(and(eq(behaviors.id, b.id), eq(behaviors.userId, userId))),
  ]);
}
