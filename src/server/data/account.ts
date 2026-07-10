import "server-only";

import { db } from "@/db";
import {
  deleteAccountForUser,
  deleteAllTrackingDataForUser,
  exportUserDataForUser,
  type UserDataExport,
} from "./account-ops";
import { requireUserId } from "./session";

export type { UserDataExport } from "./account-ops";

/**
 * Session-scoped account operations (PRD 19/20/21). Each resolves the authenticated user id
 * and delegates to the session-free logic in ./account-ops, so the actual export/deletion
 * SQL stays unit-testable against a scratch DB.
 */

/** Gathers the signed-in user's complete data export (PRD 20). Read-only, session-scoped. */
export async function exportUserData(): Promise<UserDataExport> {
  const userId = await requireUserId();
  return exportUserDataForUser(db, userId, new Date().toISOString());
}

/**
 * Deletes ALL of the signed-in user's tracking data while keeping the account, profile, and
 * auth records (PRD 19 "Delete all tracking data"). Atomic via db.batch().
 */
export async function deleteAllTrackingData(): Promise<void> {
  const userId = await requireUserId();
  await deleteAllTrackingDataForUser(db, userId);
}

/**
 * Permanently deletes the signed-in user's account and everything scoped to it (PRD 19
 * "Delete account", PRD 21), then the caller signs the user out. Atomic via db.batch().
 * Any surviving JWT is handled by the stale-session guard (StaleSessionError) next request.
 */
export async function deleteAccount(): Promise<void> {
  const userId = await requireUserId();
  await deleteAccountForUser(db, userId);
}
