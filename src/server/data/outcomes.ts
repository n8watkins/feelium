import "server-only";

import { and, asc, count, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  checkInValues,
  outcomeMetrics,
  type OutcomeDirection,
  type OutcomeInputType,
} from "@/db/schema";
import { InputTypeLockedError } from "./errors";
import { requireUserId } from "./session";

export type OutcomeInput = {
  name: string;
  inputType: OutcomeInputType;
  desiredDirection: OutcomeDirection | null;
  unit: string | null;
  description: string | null;
};

export async function listOutcomeMetrics() {
  const userId = await requireUserId();
  return db
    .select()
    .from(outcomeMetrics)
    .where(eq(outcomeMetrics.userId, userId))
    .orderBy(asc(outcomeMetrics.sortOrder), asc(outcomeMetrics.createdAt));
}

/** Active outcome metrics only, in sort order (used by the check-in form later). */
export async function listActiveOutcomeMetrics() {
  const userId = await requireUserId();
  return db
    .select()
    .from(outcomeMetrics)
    .where(
      and(eq(outcomeMetrics.userId, userId), eq(outcomeMetrics.isActive, true)),
    )
    .orderBy(asc(outcomeMetrics.sortOrder), asc(outcomeMetrics.createdAt));
}

export async function getOutcomeMetric(id: string) {
  const userId = await requireUserId();
  const [row] = await db
    .select()
    .from(outcomeMetrics)
    .where(and(eq(outcomeMetrics.id, id), eq(outcomeMetrics.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** True once any check-in value has been recorded for this metric (input-type lock). */
export async function outcomeMetricHasValues(id: string): Promise<boolean> {
  const userId = await requireUserId();
  const [row] = await db
    .select({ n: count() })
    .from(checkInValues)
    .where(
      and(
        eq(checkInValues.outcomeMetricId, id),
        eq(checkInValues.userId, userId),
      ),
    );
  return (row?.n ?? 0) > 0;
}

async function nextActiveSortOrder(userId: string): Promise<number> {
  const rows = await db
    .select({ sortOrder: outcomeMetrics.sortOrder })
    .from(outcomeMetrics)
    .where(
      and(eq(outcomeMetrics.userId, userId), eq(outcomeMetrics.isActive, true)),
    );
  return rows.reduce((max, r) => Math.max(max, r.sortOrder), -1) + 1;
}

export async function createOutcomeMetric(input: OutcomeInput) {
  const userId = await requireUserId();
  const sortOrder = await nextActiveSortOrder(userId);
  const [row] = await db
    .insert(outcomeMetrics)
    .values({ userId, sortOrder, ...input })
    .returning();
  return row;
}

export async function updateOutcomeMetric(id: string, input: OutcomeInput) {
  const userId = await requireUserId();
  const existing = await getOutcomeMetric(id);
  if (!existing) throw new Error("NOT_FOUND");

  if (
    input.inputType !== existing.inputType &&
    (await outcomeMetricHasValues(id))
  ) {
    throw new InputTypeLockedError();
  }

  await db
    .update(outcomeMetrics)
    .set({
      name: input.name,
      inputType: input.inputType,
      desiredDirection: input.desiredDirection,
      unit: input.unit,
      description: input.description,
    })
    .where(and(eq(outcomeMetrics.id, id), eq(outcomeMetrics.userId, userId)));
}

export async function archiveOutcomeMetric(id: string) {
  const userId = await requireUserId();
  await db
    .update(outcomeMetrics)
    .set({ isActive: false, archivedAt: new Date() })
    .where(and(eq(outcomeMetrics.id, id), eq(outcomeMetrics.userId, userId)));
}

export async function reactivateOutcomeMetric(id: string) {
  const userId = await requireUserId();
  const sortOrder = await nextActiveSortOrder(userId);
  await db
    .update(outcomeMetrics)
    .set({ isActive: true, archivedAt: null, sortOrder })
    .where(and(eq(outcomeMetrics.id, id), eq(outcomeMetrics.userId, userId)));
}

export async function moveOutcomeMetric(id: string, direction: "up" | "down") {
  const userId = await requireUserId();
  const active = await db
    .select()
    .from(outcomeMetrics)
    .where(
      and(eq(outcomeMetrics.userId, userId), eq(outcomeMetrics.isActive, true)),
    )
    .orderBy(asc(outcomeMetrics.sortOrder), asc(outcomeMetrics.createdAt));

  const index = active.findIndex((o) => o.id === id);
  if (index === -1) return;
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= active.length) return;

  const a = active[index];
  const b = active[swapIndex];
  await db.transaction(async (tx) => {
    await tx
      .update(outcomeMetrics)
      .set({ sortOrder: b.sortOrder })
      .where(and(eq(outcomeMetrics.id, a.id), eq(outcomeMetrics.userId, userId)));
    await tx
      .update(outcomeMetrics)
      .set({ sortOrder: a.sortOrder })
      .where(and(eq(outcomeMetrics.id, b.id), eq(outcomeMetrics.userId, userId)));
  });
}
