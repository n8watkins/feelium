import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { profiles, users } from "@/db/schema";
import { StaleSessionError } from "./errors";
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
export async function ensureProfile(): Promise<void> {
  const userId = await requireUserId();

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    throw new StaleSessionError();
  }

  await db.insert(profiles).values({ userId }).onConflictDoNothing();
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
