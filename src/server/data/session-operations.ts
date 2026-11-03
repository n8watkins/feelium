import { eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "@/db/schema";
import { users } from "@/db/schema";

type Database = LibSQLDatabase<typeof schema>;

/** The user's current session version, or null when the user no longer exists. */
export async function getSessionVersionForUser(database: Database, userId: string): Promise<number | null> {
  const [row] = await database
    .select({ sessionVersion: users.sessionVersion })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ? row.sessionVersion : null;
}

/** "Sign out on every device": every session minted before this call stops working. */
export async function bumpSessionVersionForUser(database: Database, userId: string): Promise<void> {
  await database
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, userId));
}
