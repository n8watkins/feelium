import { and, eq, isNull } from "drizzle-orm";

import { reminderSettings } from "@/db/schema";

type AppDatabase = (typeof import("@/db"))["db"];

export type ReminderCandidate = {
  userId: string;
  reminderTime: string;
  timezone: string;
  nextReminderAt: Date | null;
  deliveryLocalDate: string | null;
};

export function reminderScheduleCondition(reminder: ReminderCandidate) {
  return and(
    eq(reminderSettings.userId, reminder.userId),
    eq(reminderSettings.isEnabled, true),
    eq(reminderSettings.reminderTime, reminder.reminderTime),
    eq(reminderSettings.timezone, reminder.timezone),
    reminder.nextReminderAt === null
      ? isNull(reminderSettings.nextReminderAt)
      : eq(reminderSettings.nextReminderAt, reminder.nextReminderAt),
  );
}

export async function disableInvalidReminderSchedule(
  database: AppDatabase,
  reminder: ReminderCandidate,
): Promise<boolean> {
  const rows = await database
    .update(reminderSettings)
    .set({ isEnabled: false, nextReminderAt: null, updatedAt: new Date() })
    .where(reminderScheduleCondition(reminder))
    .returning({ id: reminderSettings.id });
  return rows.length === 1;
}
