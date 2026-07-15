import "server-only";

import { and, asc, eq, isNotNull, isNull, lte, or } from "drizzle-orm";

import { db } from "@/db";
import { pushSubscriptions, reminderSettings } from "@/db/schema";
import {
  disableInvalidReminderSchedule,
  reminderScheduleCondition,
  type ReminderCandidate,
} from "./reminder-operations";
import {
  claimReminderDeliveryLease,
  completeReminderDeliveryLease,
  deleteReminderSubscription,
  hasPendingReminderSubscriptions,
  listPendingReminderSubscriptions,
  recordReminderSubscriptionAttempt,
  releaseReminderDeliveryLease,
  renewReminderDeliveryLease,
} from "./reminder-delivery-operations";
import {
  createReminderForUser,
  deleteReminderForUser,
  listRemindersForUser,
  updateReminderForUser,
  updateReminderTimezoneForUser,
  type ReminderScheduleInput,
} from "./reminder-schedule-operations";
import { requireUserId } from "./session";

/**
 * Data access for daily reminder schedules and Web Push subscriptions.
 *
 * Two groups of functions:
 *   - User-scoped: call requireUserId() and only touch the session user's own rows.
 *   - System-scoped: take an explicit userId / no session, for the guarded reminder-send
 *     job (a scheduled trigger, not an interactive request). These must never be exposed
 *     to the client without the cron secret guard on the send route.
 */

export type ReminderSchedule = ReminderScheduleInput & { id: string };

/** The JSON shape a browser PushSubscription serializes to. */
export type WebPushSubscriptionJSON = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

// ---- User-scoped ---------------------------------------------------------------------

export async function listReminderSettings(): Promise<ReminderSchedule[]> {
  const userId = await requireUserId();
  const rows = await listRemindersForUser(db, userId);
  return rows.flatMap((row) =>
    row.reminderTime
      ? [
          {
            id: row.id,
            isEnabled: row.isEnabled,
            reminderTime: row.reminderTime,
            timezone: row.timezone,
          },
        ]
      : [],
  );
}

export async function createReminderSettings(
  input: ReminderScheduleInput,
): Promise<ReminderSchedule> {
  const userId = await requireUserId();
  const row = await createReminderForUser(db, userId, input);
  return {
    id: row.id,
    isEnabled: row.isEnabled,
    reminderTime: row.reminderTime ?? input.reminderTime,
    timezone: row.timezone,
  };
}

export async function updateReminderSettings(
  reminderId: string,
  input: ReminderScheduleInput,
): Promise<boolean> {
  const userId = await requireUserId();
  return updateReminderForUser(db, userId, reminderId, input);
}

export async function deleteReminderSettings(
  reminderId: string,
): Promise<boolean> {
  const userId = await requireUserId();
  return deleteReminderForUser(db, userId, reminderId);
}

/** Keeps an enabled reminder aligned with the browser's current IANA timezone. */
export async function updateReminderTimezone(timezone: string): Promise<void> {
  const userId = await requireUserId();
  await updateReminderTimezoneForUser(db, userId, timezone);
}

/** Stores (or refreshes) a Web Push subscription for the current user + device. */
export async function savePushSubscription(
  subscription: WebPushSubscriptionJSON,
  deviceName?: string | null,
): Promise<void> {
  const userId = await requireUserId();
  const data = subscription as unknown as Record<string, unknown>;
  await db
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint: subscription.endpoint,
      subscriptionData: data,
      deviceName: deviceName ?? null,
      lastUsedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [pushSubscriptions.userId, pushSubscriptions.endpoint],
      set: {
        subscriptionData: data,
        lastUsedAt: new Date(),
        reminderFailureCount: 0,
        reminderQuarantinedAt: null,
      },
    });
}

/** Removes one of the current user's push subscriptions by endpoint. */
export async function deleteMyPushSubscription(
  endpoint: string,
): Promise<void> {
  const userId = await requireUserId();
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint),
      ),
    );
}

/** All push subscriptions belonging to the current user (e.g. for a test send). */
export async function listMyPushSubscriptions() {
  const userId = await requireUserId();
  return db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}

// ---- System-scoped (reminder-send job only) ------------------------------------------

export type { ReminderCandidate } from "./reminder-operations";

/** A bounded batch of reminders whose persisted UTC occurrence may be due. */
export async function listReminderCandidates(
  now: Date,
  limit: number,
): Promise<ReminderCandidate[]> {
  const rows = await db
    .select({
      id: reminderSettings.id,
      userId: reminderSettings.userId,
      reminderTime: reminderSettings.reminderTime,
      timezone: reminderSettings.timezone,
      nextReminderAt: reminderSettings.nextReminderAt,
      deliveryLocalDate: reminderSettings.deliveryLocalDate,
      deliveryOccurrenceAt: reminderSettings.deliveryOccurrenceAt,
    })
    .from(reminderSettings)
    .where(
      and(
        eq(reminderSettings.isEnabled, true),
        isNotNull(reminderSettings.reminderTime),
        or(
          isNull(reminderSettings.nextReminderAt),
          lte(reminderSettings.nextReminderAt, now),
        ),
      ),
    )
    .orderBy(asc(reminderSettings.nextReminderAt))
    .limit(limit);
  return rows.flatMap((r) =>
    r.reminderTime
      ? [
          {
            id: r.id,
            userId: r.userId,
            reminderTime: r.reminderTime,
            timezone: r.timezone,
            nextReminderAt: r.nextReminderAt,
            deliveryLocalDate: r.deliveryLocalDate,
            deliveryOccurrenceAt: r.deliveryOccurrenceAt,
          },
        ]
      : [],
  );
}

/** Advances a candidate that is stale or not yet due to its next UTC occurrence. */
export async function scheduleNextReminder(
  reminder: ReminderCandidate,
  nextAt: Date,
): Promise<void> {
  await db
    .update(reminderSettings)
    .set({ nextReminderAt: nextAt, updatedAt: new Date() })
    .where(reminderScheduleCondition(reminder));
}

export async function disableInvalidReminder(
  reminder: ReminderCandidate,
): Promise<boolean> {
  return disableInvalidReminderSchedule(db, reminder);
}

/**
 * Atomically reserves one reminder delivery for a user's local calendar date.
 * Only one overlapping cron invocation can receive a successful claim.
 */
export async function claimReminderDelivery(
  reminder: ReminderCandidate,
  localDate: string,
  occurrenceAt: Date,
  now: Date,
  leaseDurationMs: number,
): Promise<string | null> {
  return claimReminderDeliveryLease(
    db,
    reminder,
    localDate,
    occurrenceAt,
    now,
    leaseDurationMs,
  );
}

export async function releaseReminderDelivery(
  reminderId: string,
  userId: string,
  localDate: string,
  occurrenceAt: Date,
  token: string,
  now: Date,
  retryAt: Date,
): Promise<boolean> {
  return releaseReminderDeliveryLease(
    db,
    reminderId,
    userId,
    localDate,
    occurrenceAt,
    token,
    now,
    retryAt,
  );
}

export async function renewReminderDelivery(
  reminderId: string,
  userId: string,
  localDate: string,
  occurrenceAt: Date,
  token: string,
  now: Date,
  leaseDurationMs: number,
): Promise<boolean> {
  return renewReminderDeliveryLease(
    db,
    reminderId,
    userId,
    localDate,
    occurrenceAt,
    token,
    now,
    leaseDurationMs,
  );
}

/** Marks the claimed local date complete and advances its persisted UTC schedule. */
export async function completeReminderDelivery(
  reminderId: string,
  userId: string,
  localDate: string,
  occurrenceAt: Date,
  token: string,
  now: Date,
  nextAt: Date,
): Promise<boolean> {
  return completeReminderDeliveryLease(
    db,
    reminderId,
    userId,
    localDate,
    occurrenceAt,
    token,
    now,
    nextAt,
  );
}

export async function listPushSubscriptionsForReminder(
  reminderId: string,
  userId: string,
  occurrenceAt: Date,
  limit: number,
) {
  return listPendingReminderSubscriptions(
    db,
    reminderId,
    userId,
    occurrenceAt,
    limit,
  );
}

export async function hasPendingPushSubscriptionsForReminder(
  reminderId: string,
  userId: string,
  occurrenceAt: Date,
): Promise<boolean> {
  return hasPendingReminderSubscriptions(db, reminderId, userId, occurrenceAt);
}

export async function markPushSubscriptionAttempt(
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
  return recordReminderSubscriptionAttempt(
    db,
    subscriptionId,
    reminderId,
    userId,
    localDate,
    occurrenceAt,
    token,
    delivered,
    attemptedAt,
    maxFailures,
  );
}

export async function deletePushSubscriptionForReminder(
  subscriptionId: string,
  reminderId: string,
  userId: string,
  localDate: string,
  occurrenceAt: Date,
  token: string,
  deletedAt: Date,
): Promise<boolean> {
  return deleteReminderSubscription(
    db,
    subscriptionId,
    reminderId,
    userId,
    localDate,
    occurrenceAt,
    token,
    deletedAt,
  );
}
