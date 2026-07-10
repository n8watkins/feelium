import "server-only";

import { and, count, desc, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  behaviors,
  checkIns,
  outcomeMetrics,
  profiles,
} from "@/db/schema";

/**
 * Central data-access module.
 *
 * This is the ONLY place application data is read or written. Every function derives the
 * user id from the authenticated session via `requireUserId()` and scopes its query by
 * that id. Callers never pass a user id in - a client-supplied id is never trusted. This
 * is how the app preserves the PRD privacy guarantee (a user can only ever access their
 * own records) without database-level RLS.
 */

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    // Reached only if a caller bypasses the route guard; fail closed.
    throw new Error("Not authenticated");
  }
  return userId;
}

/** Creates the profile row on first sign-in (idempotent). Replaces the old DB trigger. */
export async function ensureProfile(): Promise<void> {
  const userId = await requireUserId();
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

export async function listActiveBehaviors() {
  const userId = await requireUserId();
  return db
    .select()
    .from(behaviors)
    .where(and(eq(behaviors.userId, userId), eq(behaviors.isActive, true)))
    .orderBy(behaviors.sortOrder);
}

export async function listActiveOutcomeMetrics() {
  const userId = await requireUserId();
  return db
    .select()
    .from(outcomeMetrics)
    .where(
      and(eq(outcomeMetrics.userId, userId), eq(outcomeMetrics.isActive, true)),
    )
    .orderBy(outcomeMetrics.sortOrder);
}

/** Count of check-ins the current user recorded on a given local calendar date. */
export async function countCheckInsForDate(localDate: string): Promise<number> {
  const userId = await requireUserId();
  const [row] = await db
    .select({ value: count() })
    .from(checkIns)
    .where(and(eq(checkIns.userId, userId), eq(checkIns.localDate, localDate)));
  return row?.value ?? 0;
}

/** Most recent check-ins for the current user (newest first). */
export async function listRecentCheckIns(limit = 5) {
  const userId = await requireUserId();
  return db
    .select()
    .from(checkIns)
    .where(eq(checkIns.userId, userId))
    .orderBy(desc(checkIns.occurredAt))
    .limit(limit);
}
