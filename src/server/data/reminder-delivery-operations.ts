import { and, asc, eq, exists, gt, isNull, lte, ne, or, sql } from "drizzle-orm";

import { pushSubscriptions, reminderSettings } from "@/db/schema";
import {
  reminderScheduleCondition,
  type ReminderCandidate,
} from "./reminder-operations";

type AppDatabase = (typeof import("@/db"))["db"];

function activeReminderDeliveryLease(
  database: AppDatabase,
  userId: string,
  localDate: string,
  token: string,
  now: Date,
) {
  return exists(
    database
      .select({ id: reminderSettings.id })
      .from(reminderSettings)
      .where(
        and(
          eq(reminderSettings.userId, userId),
          eq(reminderSettings.deliveryLocalDate, localDate),
          eq(reminderSettings.deliveryLeaseToken, token),
          gt(reminderSettings.deliveryLeaseExpiresAt, now),
        ),
      ),
  );
}

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

export async function renewReminderDeliveryLease(
  database: AppDatabase,
  userId: string,
  localDate: string,
  token: string,
  now: Date,
  leaseDurationMs: number,
): Promise<boolean> {
  const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);
  const rows = await database
    .update(reminderSettings)
    .set({
      deliveryLeaseExpiresAt: leaseExpiresAt,
      nextReminderAt: leaseExpiresAt,
      updatedAt: now,
    })
    .where(
      and(
        eq(reminderSettings.userId, userId),
        eq(reminderSettings.deliveryLocalDate, localDate),
        eq(reminderSettings.deliveryLeaseToken, token),
        gt(reminderSettings.deliveryLeaseExpiresAt, now),
      ),
    )
    .returning({ id: reminderSettings.id });
  return rows.length === 1;
}

export async function releaseReminderDeliveryLease(
  database: AppDatabase,
  userId: string,
  localDate: string,
  token: string,
  now: Date,
  retryAt: Date,
): Promise<boolean> {
  const rows = await database
    .update(reminderSettings)
    .set({
      deliveryLeaseToken: null,
      deliveryLeaseExpiresAt: null,
      nextReminderAt: retryAt,
      updatedAt: now,
    })
    .where(
      and(
        eq(reminderSettings.userId, userId),
        eq(reminderSettings.deliveryLocalDate, localDate),
        eq(reminderSettings.deliveryLeaseToken, token),
        gt(reminderSettings.deliveryLeaseExpiresAt, now),
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
  now: Date,
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
      updatedAt: now,
    })
    .where(
      and(
        eq(reminderSettings.userId, userId),
        eq(reminderSettings.deliveryLocalDate, localDate),
        eq(reminderSettings.deliveryLeaseToken, token),
        gt(reminderSettings.deliveryLeaseExpiresAt, now),
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
  token: string,
  delivered: boolean,
  attemptedAt: Date,
  maxFailures: number,
): Promise<boolean> {
  const quarantineTimestamp = Math.floor(attemptedAt.getTime() / 1000);
  const rows = await database
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
        activeReminderDeliveryLease(database, userId, localDate, token, attemptedAt),
      ),
    )
    .returning({ id: pushSubscriptions.id });
  return rows.length === 1;
}

export async function deleteReminderSubscription(
  database: AppDatabase,
  subscriptionId: string,
  userId: string,
  localDate: string,
  token: string,
  deletedAt: Date,
): Promise<boolean> {
  const rows = await database
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.id, subscriptionId),
        eq(pushSubscriptions.userId, userId),
        activeReminderDeliveryLease(database, userId, localDate, token, deletedAt),
      ),
    )
    .returning({ id: pushSubscriptions.id });
  return rows.length === 1;
}
