import {
  and,
  asc,
  eq,
  exists,
  getTableColumns,
  gt,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";

import {
  pushSubscriptions,
  reminderDeliveryAttempts,
  reminderSettings,
} from "@/db/schema";
import {
  reminderScheduleCondition,
  type ReminderCandidate,
} from "./reminder-operations";

type AppDatabase = (typeof import("@/db"))["db"];

function activeReminderDeliveryLease(
  database: AppDatabase,
  reminderId: string,
  userId: string,
  localDate: string,
  occurrenceAt: Date,
  token: string,
  now: Date,
) {
  return exists(
    database
      .select({ id: reminderSettings.id })
      .from(reminderSettings)
      .where(
        and(
          eq(reminderSettings.id, reminderId),
          eq(reminderSettings.userId, userId),
          eq(reminderSettings.deliveryLocalDate, localDate),
          eq(reminderSettings.deliveryOccurrenceAt, occurrenceAt),
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
  occurrenceAt: Date,
  now: Date,
  leaseDurationMs: number,
): Promise<string | null> {
  const token = crypto.randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);
  const rows = await database
    .update(reminderSettings)
    .set({
      deliveryLocalDate: localDate,
      deliveryOccurrenceAt: occurrenceAt,
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
  reminderId: string,
  userId: string,
  localDate: string,
  occurrenceAt: Date,
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
        eq(reminderSettings.id, reminderId),
        eq(reminderSettings.userId, userId),
        eq(reminderSettings.deliveryLocalDate, localDate),
        eq(reminderSettings.deliveryOccurrenceAt, occurrenceAt),
        eq(reminderSettings.deliveryLeaseToken, token),
        gt(reminderSettings.deliveryLeaseExpiresAt, now),
      ),
    )
    .returning({ id: reminderSettings.id });
  return rows.length === 1;
}

export async function releaseReminderDeliveryLease(
  database: AppDatabase,
  reminderId: string,
  userId: string,
  localDate: string,
  occurrenceAt: Date,
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
        eq(reminderSettings.id, reminderId),
        eq(reminderSettings.userId, userId),
        eq(reminderSettings.deliveryLocalDate, localDate),
        eq(reminderSettings.deliveryOccurrenceAt, occurrenceAt),
        eq(reminderSettings.deliveryLeaseToken, token),
        gt(reminderSettings.deliveryLeaseExpiresAt, now),
      ),
    )
    .returning({ id: reminderSettings.id });
  return rows.length === 1;
}

export async function completeReminderDeliveryLease(
  database: AppDatabase,
  reminderId: string,
  userId: string,
  localDate: string,
  occurrenceAt: Date,
  token: string,
  now: Date,
  nextAt: Date,
): Promise<boolean> {
  const rows = await database
    .update(reminderSettings)
    .set({
      lastSentLocalDate: localDate,
      deliveryLocalDate: null,
      deliveryOccurrenceAt: null,
      deliveryLeaseToken: null,
      deliveryLeaseExpiresAt: null,
      nextReminderAt: nextAt,
      updatedAt: now,
    })
    .where(
      and(
        eq(reminderSettings.id, reminderId),
        eq(reminderSettings.userId, userId),
        eq(reminderSettings.deliveryLocalDate, localDate),
        eq(reminderSettings.deliveryOccurrenceAt, occurrenceAt),
        eq(reminderSettings.deliveryLeaseToken, token),
        gt(reminderSettings.deliveryLeaseExpiresAt, now),
      ),
    )
    .returning({ id: reminderSettings.id });
  return rows.length === 1;
}

export async function listPendingReminderSubscriptions(
  database: AppDatabase,
  reminderId: string,
  userId: string,
  occurrenceAt: Date,
  limit: number,
) {
  return database
    .select(getTableColumns(pushSubscriptions))
    .from(pushSubscriptions)
    .leftJoin(
      reminderDeliveryAttempts,
      and(
        eq(reminderDeliveryAttempts.subscriptionId, pushSubscriptions.id),
        eq(reminderDeliveryAttempts.reminderId, reminderId),
        eq(reminderDeliveryAttempts.occurrenceAt, occurrenceAt),
      ),
    )
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        isNull(pushSubscriptions.reminderQuarantinedAt),
        isNull(reminderDeliveryAttempts.deliveredAt),
      ),
    )
    .orderBy(
      asc(reminderDeliveryAttempts.lastAttemptAt),
      asc(pushSubscriptions.id),
    )
    .limit(limit);
}

export async function hasPendingReminderSubscriptions(
  database: AppDatabase,
  reminderId: string,
  userId: string,
  occurrenceAt: Date,
): Promise<boolean> {
  const rows = await database
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .leftJoin(
      reminderDeliveryAttempts,
      and(
        eq(reminderDeliveryAttempts.subscriptionId, pushSubscriptions.id),
        eq(reminderDeliveryAttempts.reminderId, reminderId),
        eq(reminderDeliveryAttempts.occurrenceAt, occurrenceAt),
      ),
    )
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        isNull(pushSubscriptions.reminderQuarantinedAt),
        isNull(reminderDeliveryAttempts.deliveredAt),
      ),
    )
    .limit(1);
  return rows.length === 1;
}

export async function recordReminderSubscriptionAttempt(
  database: AppDatabase,
  subscriptionId: string,
  reminderId: string,
  userId: string,
  localDate: string,
  occurrenceAt: Date,
  token: string,
  delivered: boolean,
  attemptedAt: Date,
  maxFailures: number,
): Promise<boolean> {
  const occurrenceTimestamp = Math.floor(occurrenceAt.getTime() / 1000);
  const attemptedTimestamp = Math.floor(attemptedAt.getTime() / 1000);
  const inserted = await database
    .insert(reminderDeliveryAttempts)
    .select(
      database
        .select({
          id: sql<string>`${crypto.randomUUID()}`.as("id"),
          reminderId: reminderSettings.id,
          subscriptionId: sql<string>`${subscriptionId}`.as("subscription_id"),
          occurrenceAt: sql<Date>`${occurrenceTimestamp}`.as("occurrence_at"),
          localDate: sql<string>`${localDate}`.as("local_date"),
          attemptCount: sql<number>`1`.as("attempt_count"),
          lastAttemptAt: sql<Date>`${attemptedTimestamp}`.as("last_attempt_at"),
          deliveredAt: delivered
            ? sql<Date>`${attemptedTimestamp}`.as("delivered_at")
            : sql<Date | null>`null`.as("delivered_at"),
          createdAt: sql<Date>`${attemptedTimestamp}`.as("created_at"),
          updatedAt: sql<Date>`${attemptedTimestamp}`.as("updated_at"),
        })
        .from(reminderSettings)
        .where(
          and(
            eq(reminderSettings.id, reminderId),
            eq(reminderSettings.userId, userId),
            activeReminderDeliveryLease(
              database,
              reminderId,
              userId,
              localDate,
              occurrenceAt,
              token,
              attemptedAt,
            ),
            exists(
              database
                .select({ id: pushSubscriptions.id })
                .from(pushSubscriptions)
                .where(
                  and(
                    eq(pushSubscriptions.id, subscriptionId),
                    eq(pushSubscriptions.userId, userId),
                  ),
                ),
            ),
          ),
        ),
    )
    .onConflictDoUpdate({
      target: [
        reminderDeliveryAttempts.reminderId,
        reminderDeliveryAttempts.subscriptionId,
        reminderDeliveryAttempts.occurrenceAt,
      ],
      set: {
        attemptCount: sql`${reminderDeliveryAttempts.attemptCount} + 1`,
        lastAttemptAt: attemptedAt,
        deliveredAt: delivered ? attemptedAt : undefined,
        updatedAt: attemptedAt,
      },
    })
    .returning({ id: reminderDeliveryAttempts.id });
  if (inserted.length !== 1) return false;

  const quarantineTimestamp = Math.floor(attemptedAt.getTime() / 1000);
  const subscriptionRows = await database
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
        activeReminderDeliveryLease(
          database,
          reminderId,
          userId,
          localDate,
          occurrenceAt,
          token,
          attemptedAt,
        ),
      ),
    )
    .returning({ id: pushSubscriptions.id });
  return subscriptionRows.length === 1;
}

export async function deleteReminderSubscription(
  database: AppDatabase,
  subscriptionId: string,
  reminderId: string,
  userId: string,
  localDate: string,
  occurrenceAt: Date,
  token: string,
  deletedAt: Date,
): Promise<boolean> {
  const rows = await database
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.id, subscriptionId),
        eq(pushSubscriptions.userId, userId),
        activeReminderDeliveryLease(
          database,
          reminderId,
          userId,
          localDate,
          occurrenceAt,
          token,
          deletedAt,
        ),
      ),
    )
    .returning({ id: pushSubscriptions.id });
  return rows.length === 1;
}
