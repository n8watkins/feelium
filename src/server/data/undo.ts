import "server-only";

import { db } from "@/db";
import { requireUserId } from "./session";
import {
  deleteCategoryWithUndo,
  deleteCheckInWithUndo,
  deleteOutcomeWithUndo,
  deleteTagWithUndo,
  purgeExpiredUndo,
  undoForUser,
} from "./undo-operations";

/** Session-scoped undoable deletes; the logic lives in ./undo-operations. */

export async function deleteCheckIn(id: string) {
  return deleteCheckInWithUndo(db, await requireUserId(), id);
}

export async function deleteOutcomeMetric(id: string, options?: { eraseAnswers?: boolean }) {
  return deleteOutcomeWithUndo(db, await requireUserId(), id, options);
}

export async function deleteTag(id: string) {
  return deleteTagWithUndo(db, await requireUserId(), id);
}

export async function deleteBehaviorCategory(id: string) {
  return deleteCategoryWithUndo(db, await requireUserId(), id);
}

/** Restores what an undoable delete removed; null when it can no longer be undone. */
export async function undoDelete(undoId: string) {
  return undoForUser(db, await requireUserId(), undoId);
}

/**
 * System-scoped (no session): drops every expired Undo snapshot. The reminder job runs it
 * every five minutes, so a delete is final within minutes even if nobody deletes again.
 */
export async function purgeExpiredUndoEntries() {
  await purgeExpiredUndo(db);
}
