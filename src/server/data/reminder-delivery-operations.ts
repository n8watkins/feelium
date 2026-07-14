import { and, asc, eq, isNull, lte, ne, or, sql } from "drizzle-orm";

import { pushSubscriptions, reminderSettings } from "@/db/schema";
import {
  reminderScheduleCondition,
  type ReminderCandidate,
} from "./reminder-operations";

type AppDatabase = (typeof import("@/db"))["db"];

export async function claimReminderDeliveryLease(
  database: AppDatabase,
  reminder: ReminderCandidate,
  localDate: string,
  now: Date,
  leaseDurationMs: number,
): Promise<string | null> {
  const token = crypto.randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);
  const rows = await database
    .update(reminderSettings)
    .set({
      deliveryLocalDate: localDate,
      deliveryLeaseToken: token,
      deliveryLeaseExpiresAt: leaseExpiresAt,
      nextReminderAt: leaseExpiresAt,
      updatedAt: now,
    })
    .where(
      and(
        reminderScheduleCondition(reminder),
        or(
          isNull(reminderSettings.lastSentLocalDate),
          ne(reminderSettings.lastSentLocalDate, localDate),
        ),
        or(
          isNull(reminderSettings.deliveryLeaseExpiresAt),
          lte(reminderSettings.deliveryLeaseExpiresAt, now),
        ),
      ),
    )
    .returning({ id: reminderSettings.id });
  return rows.length === 1 ? token : null;
}

export async function releaseReminderDeliveryLease(
  database: AppDatabase,
  userId: string,
  localDate: string,
  token: string,
  retryAt: Date,
): Promise<boolean> {
  const rows = await database
    .update(reminderSettings)
    .set({
      deliveryLeaseToken: null,
      deliveryLeaseExpiresAt: null,
      nextReminderAt: retryAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(reminderSettings.userId, userId),
        eq(reminderSettings.deliveryLocalDate, localDate),
        eq(reminderSettings.deliveryLeaseToken, token),
      ),
    )
    .returning({ id: reminderSettings.id });
  return rows.length === 1;
}

export async function completeReminderDeliveryLease(
  database: AppDatabase,
  userId: string,
  localDate: string,
  token: string,
  nextAt: Date,
): Promise<boolean> {
  const rows = await database
    .update(reminderSettings)
    .set({
      lastSentLocalDate: localDate,
      deliveryLocalDate: null,
      deliveryLeaseToken: null,
      deliveryLeaseExpiresAt: null,
      nextReminderAt: nextAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(reminderSettings.userId, userId),
        eq(reminderSettings.deliveryLocalDate, localDate),
        eq(reminderSettings.deliveryLeaseToken, token),
      ),
    )
    .returning({ id: reminderSettings.id });
  return rows.length === 1;
}

export async function listPendingReminderSubscriptions(
  database: AppDatabase,
  userId: string,
  localDate: string,
  limit: number,
) {
  return database
    .select()
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        isNull(pushSubscriptions.reminderQuarantinedAt),
        or(
          isNull(pushSubscriptions.lastReminderLocalDate),
          ne(pushSubscriptions.lastReminderLocalDate, localDate),
        ),
      ),
    )
    .orderBy(
      asc(pushSubscriptions.lastReminderAttemptAt),
      asc(pushSubscriptions.id),
    )
    .limit(limit);
}

export async function hasPendingReminderSubscriptions(
  database: AppDatabase,
  userId: string,
  localDate: string,
): Promise<boolean> {
  const rows = await database
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        isNull(pushSubscriptions.reminderQuarantinedAt),
        or(
          isNull(pushSubscriptions.lastReminderLocalDate),
          ne(pushSubscriptions.lastReminderLocalDate, localDate),
        ),
      ),
    )
    .limit(1);
  return rows.length === 1;
}

export async function recordReminderSubscriptionAttempt(
  database: AppDatabase,
  subscriptionId: string,
  userId: string,
  localDate: string,
  delivered: boolean,
  attemptedAt: Date,
  maxFailures: number,
): Promise<void> {
  const quarantineTimestamp = Math.floor(attemptedAt.getTime() / 1000);
  await database
    .update(pushSubscriptions)
    .set({
      lastReminderLocalDate: delivered ? localDate : undefined,
      lastReminderAttemptAt: attemptedAt,
      reminderFailureCount: delivered
        ? 0
        : sql`${pushSubscriptions.reminderFailureCount} + 1`,
      reminderQuarantinedAt: delivered
        ? null
        : sql`case
            when ${pushSubscriptions.reminderFailureCount} + 1 >= ${maxFailures}
            then ${quarantineTimestamp}
            else ${pushSubscriptions.reminderQuarantinedAt}
          end`,
    })
    .where(
      and(
        eq(pushSubscriptions.id, subscriptionId),
        eq(pushSubscriptions.userId, userId),
      ),
    );
}

export async function deleteReminderSubscription(
  database: AppDatabase,
  subscriptionId: string,
  userId: string,
): Promise<void> {
  await database
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.id, subscriptionId),
        eq(pushSubscriptions.userId, userId),
      ),
    );
}
