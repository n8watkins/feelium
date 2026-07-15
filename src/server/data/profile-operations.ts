import { and, eq } from "drizzle-orm";

import { profiles, users } from "@/db/schema";

type AppDatabase = (typeof import("@/db"))["db"];

export async function ensureProfileForUser(database: AppDatabase, userId: string) {
  const [user] = await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return null;

  await database
    .insert(profiles)
    .values({ userId, autoSyncTimezone: true })
    .onConflictDoNothing();

  const [profile] = await database
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  return profile ?? null;
}

export async function syncProfileTimeZone(
  database: AppDatabase,
  userId: string,
  timezone: string,
): Promise<boolean> {
  const rows = await database
    .update(profiles)
    .set({ timezone, autoSyncTimezone: false, updatedAt: new Date() })
    .where(and(eq(profiles.userId, userId), eq(profiles.autoSyncTimezone, true)))
    .returning({ userId: profiles.userId });
  return rows.length === 1;
}

export async function updateProfilePreferencesForUser(
  database: AppDatabase,
  userId: string,
  input: { timezone: string; weekStartsOn: number },
): Promise<boolean> {
  const rows = await database
    .update(profiles)
    .set({
      timezone: input.timezone,
      autoSyncTimezone: false,
      weekStartsOn: input.weekStartsOn,
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, userId))
    .returning({ userId: profiles.userId });
  return rows.length === 1;
}

export async function setProfileTimeZoneForUser(
  database: AppDatabase,
  userId: string,
  timezone: string,
): Promise<boolean> {
  const rows = await database
    .update(profiles)
    .set({
      timezone,
      autoSyncTimezone: false,
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, userId))
    .returning({ userId: profiles.userId });
  return rows.length === 1;
}
