import "server-only";

import { and, count, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { checkIns } from "@/db/schema";
import { requireUserId } from "./session";

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
