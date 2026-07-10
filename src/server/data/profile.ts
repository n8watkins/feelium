import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { profiles } from "@/db/schema";
import { requireUserId } from "./session";

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
