import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { profiles } from "@/db/schema";
import { isValidTimeZone } from "@/lib/date";
import { StaleSessionError } from "./errors";
import { ensureProfileForUser, syncProfileTimeZone } from "./profile-operations";
import { requireUserId } from "./session";

/**
 * Creates the profile row on first sign-in (idempotent). Replaces the old DB trigger.
 *
 * Guards against a stale JWT first: if the session's user id no longer exists (account
 * deleted elsewhere, or a dev database reset), inserting the profile would fail the
 * user_id foreign key. We detect the missing user with a cheap primary-key lookup and
 * raise StaleSessionError so the layout can sign the request out cleanly instead of
 * crashing with a foreign-key error.
 */
export async function ensureProfile() {
  const userId = await requireUserId();
  const profile = await ensureProfileForUser(db, userId);
  if (!profile) throw new StaleSessionError();
  return profile;
}

export async function getCurrentProfile() {
  const userId = await requireUserId();
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return profile ?? null;
}

export type ProfilePreferences = {
  timezone: string;
  weekStartsOn: number;
};

/** Updates the current user's calendar preferences after validating their ranges. */
export async function updateProfilePreferences(
  input: ProfilePreferences,
): Promise<void> {
  if (!isValidTimeZone(input.timezone)) throw new Error("INVALID_TIMEZONE");
  if (!Number.isInteger(input.weekStartsOn) || input.weekStartsOn < 0 || input.weekStartsOn > 6) {
    throw new Error("INVALID_WEEK_START");
  }

  const userId = await requireUserId();
  await db
    .update(profiles)
    .set({
      timezone: input.timezone,
      autoSyncTimezone: false,
      weekStartsOn: input.weekStartsOn,
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, userId));
}

/** Updates only the timezone detected by the signed-in user's browser. */
export async function updateProfileTimeZone(timezone: string): Promise<void> {
  if (!isValidTimeZone(timezone)) throw new Error("INVALID_TIMEZONE");
  const userId = await requireUserId();
  await syncProfileTimeZone(db, userId, timezone);
}
