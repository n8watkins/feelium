import type { BatchItem } from "drizzle-orm/batch";
import { and, eq, sql } from "drizzle-orm";

import { profiles, reminderSettings, users } from "@/db/schema";
import { reminderScheduleState } from "./reminder-schedule-operations";

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

type ProfileTimeZoneUpdate = {
  timezone: string;
  weekStartsOn?: number;
  requireAutoSync?: boolean;
};

const TIMEZONE_UPDATE_ATTEMPTS = 3;

function reminderSnapshotGuard(
  userId: string,
  reminders: { id: string; reminderTime: string }[],
) {
  const enabledCount = sql<number>`(
    select count(*) from ${reminderSettings}
    where ${reminderSettings.userId} = ${userId}
      and ${reminderSettings.isEnabled} = 1
  )`;
  if (reminders.length === 0) return sql`${enabledCount} = 0`;

  const members = sql.join(
    reminders.map(
      (reminder) =>
        sql`(${reminderSettings.id} = ${reminder.id} and ${reminderSettings.reminderTime} = ${reminder.reminderTime})`,
    ),
    sql` or `,
  );
  const matchingCount = sql<number>`(
    select count(*) from ${reminderSettings}
    where ${reminderSettings.userId} = ${userId}
      and ${reminderSettings.isEnabled} = 1
      and (${members})
  )`;
  return sql`${enabledCount} = ${reminders.length} and ${matchingCount} = ${reminders.length}`;
}

/**
 * Updates a profile timezone and every enabled reminder in one atomic batch.
 * A snapshot guard retries the whole batch if reminder membership or times changed
 * between the initial read and the transaction beginning.
 */
export async function updateProfileAndReminderTimeZoneForUser(
  database: AppDatabase,
  userId: string,
  input: ProfileTimeZoneUpdate,
): Promise<boolean> {
  for (let attempt = 0; attempt < TIMEZONE_UPDATE_ATTEMPTS; attempt += 1) {
    const snapshot = (
      await database
        .select({
          id: reminderSettings.id,
          reminderTime: reminderSettings.reminderTime,
        })
        .from(reminderSettings)
        .where(
          and(
            eq(reminderSettings.userId, userId),
            eq(reminderSettings.isEnabled, true),
          ),
        )
    ).flatMap((reminder) =>
      reminder.reminderTime
        ? [{ id: reminder.id, reminderTime: reminder.reminderTime }]
        : [],
    );
    const guard = reminderSnapshotGuard(userId, snapshot);
    const profileCondition = and(
      eq(profiles.userId, userId),
      input.requireAutoSync ? eq(profiles.autoSyncTimezone, true) : undefined,
      guard,
    );
    const profileValues = {
      timezone: input.timezone,
      autoSyncTimezone: false,
      ...(input.weekStartsOn === undefined
        ? {}
        : { weekStartsOn: input.weekStartsOn }),
      updatedAt: new Date(),
    };
    const statements: BatchItem<"sqlite">[] = [
      database
        .update(profiles)
        .set(profileValues)
        .where(profileCondition)
        .returning({ userId: profiles.userId }),
    ];
    for (const reminder of snapshot) {
      statements.push(
        database
          .update(reminderSettings)
          .set(
            reminderScheduleState({
              isEnabled: true,
              reminderTime: reminder.reminderTime,
              timezone: input.timezone,
            }),
          )
          .where(
            and(
              eq(reminderSettings.id, reminder.id),
              eq(reminderSettings.userId, userId),
              eq(reminderSettings.isEnabled, true),
              eq(reminderSettings.reminderTime, reminder.reminderTime),
              guard,
            ),
          ),
      );
    }

    const [profileRows] = await database.batch(
      statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
    );
    if (Array.isArray(profileRows) && profileRows.length === 1) return true;

    const [profile] = await database
      .select({ autoSyncTimezone: profiles.autoSyncTimezone })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    if (!profile || (input.requireAutoSync && !profile.autoSyncTimezone)) {
      return false;
    }
  }

  throw new Error("REMINDER_SCHEDULE_CHANGED");
}
