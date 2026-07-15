import { and, asc, eq } from "drizzle-orm";

import { reminderSettings } from "@/db/schema";
import { nextReminderAt } from "@/lib/reminders";

type AppDatabase = (typeof import("@/db"))["db"];

export type ReminderScheduleInput = {
  isEnabled: boolean;
  reminderTime: string;
  timezone: string;
};

function scheduleState(input: ReminderScheduleInput) {
  return {
    isEnabled: input.isEnabled,
    reminderTime: input.reminderTime,
    timezone: input.timezone,
    nextReminderAt: input.isEnabled
      ? nextReminderAt(input.reminderTime, input.timezone)
      : null,
    deliveryLocalDate: null,
    deliveryOccurrenceAt: null,
    deliveryLeaseToken: null,
    deliveryLeaseExpiresAt: null,
    updatedAt: new Date(),
  };
}

export async function listRemindersForUser(
  database: AppDatabase,
  userId: string,
) {
  return database
    .select()
    .from(reminderSettings)
    .where(eq(reminderSettings.userId, userId))
    .orderBy(
      asc(reminderSettings.reminderTime),
      asc(reminderSettings.createdAt),
    );
}

export async function createReminderForUser(
  database: AppDatabase,
  userId: string,
  input: ReminderScheduleInput,
) {
  const [created] = await database
    .insert(reminderSettings)
    .values({ userId, ...scheduleState(input) })
    .returning();
  return created;
}

export async function updateReminderForUser(
  database: AppDatabase,
  userId: string,
  reminderId: string,
  input: ReminderScheduleInput,
): Promise<boolean> {
  const rows = await database
    .update(reminderSettings)
    .set(scheduleState(input))
    .where(
      and(
        eq(reminderSettings.id, reminderId),
        eq(reminderSettings.userId, userId),
      ),
    )
    .returning({ id: reminderSettings.id });
  return rows.length === 1;
}

export async function deleteReminderForUser(
  database: AppDatabase,
  userId: string,
  reminderId: string,
): Promise<boolean> {
  const rows = await database
    .delete(reminderSettings)
    .where(
      and(
        eq(reminderSettings.id, reminderId),
        eq(reminderSettings.userId, userId),
      ),
    )
    .returning({ id: reminderSettings.id });
  return rows.length === 1;
}

export async function updateReminderTimezoneForUser(
  database: AppDatabase,
  userId: string,
  timezone: string,
): Promise<number> {
  const reminders = await database
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
    );
  let updated = 0;
  for (const reminder of reminders) {
    if (!reminder.reminderTime) continue;
    const rows = await database
      .update(reminderSettings)
      .set(
        scheduleState({
          isEnabled: true,
          reminderTime: reminder.reminderTime,
          timezone,
        }),
      )
      .where(
        and(
          eq(reminderSettings.id, reminder.id),
          eq(reminderSettings.userId, userId),
        ),
      )
      .returning({ id: reminderSettings.id });
    updated += rows.length;
  }
  return updated;
}
