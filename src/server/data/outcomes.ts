import "server-only";

import { db } from "@/db";
import {
  archiveOutcomeForUser,
  countAnswersByOutcomeForUser,
  countOutcomeAnswersForUser,
  createOutcomeForUser,
  deleteOutcomeForUser,
  getOutcomeForUser,
  listActiveOutcomesForUser,
  listOutcomesForUser,
  moveOutcomeForUser,
  reactivateOutcomeForUser,
  updateOutcomeForUser,
  type OutcomeInput,
} from "./outcome-operations";
import { requireUserId } from "./session";

export type { OutcomeInput } from "./outcome-operations";

/**
 * The session user's feelings (outcome metrics). Each call scopes to the signed-in user;
 * the logic itself lives in ./outcome-operations.
 */

/** Active and archived feelings; `includeDeleted` adds deleted ones (for old check-ins). */
export async function listOutcomeMetrics(options?: { includeDeleted?: boolean }) {
  return listOutcomesForUser(db, await requireUserId(), options);
}

/** The feelings a check-in asks about, in order. */
export async function listActiveOutcomeMetrics() {
  return listActiveOutcomesForUser(db, await requireUserId());
}

export async function getOutcomeMetric(id: string) {
  return getOutcomeForUser(db, await requireUserId(), id);
}

/** How many check-ins hold an answer for this feeling (locks its input type). */
export async function countOutcomeMetricAnswers(id: string): Promise<number> {
  return countOutcomeAnswersForUser(db, await requireUserId(), id);
}

/** Answer counts per feeling id (feelings with no answers are absent). */
export async function countAnswersByOutcome(): Promise<Map<string, number>> {
  return countAnswersByOutcomeForUser(db, await requireUserId());
}

export async function createOutcomeMetric(input: OutcomeInput) {
  return createOutcomeForUser(db, await requireUserId(), input);
}

export async function updateOutcomeMetric(id: string, input: OutcomeInput) {
  return updateOutcomeForUser(db, await requireUserId(), id, input);
}

export async function archiveOutcomeMetric(id: string) {
  return archiveOutcomeForUser(db, await requireUserId(), id);
}

export async function reactivateOutcomeMetric(id: string) {
  return reactivateOutcomeForUser(db, await requireUserId(), id);
}

export async function moveOutcomeMetric(id: string, direction: "up" | "down") {
  return moveOutcomeForUser(db, await requireUserId(), id, direction);
}

export async function deleteOutcomeMetric(id: string, options?: { eraseAnswers?: boolean }) {
  return deleteOutcomeForUser(db, await requireUserId(), id, options);
}
