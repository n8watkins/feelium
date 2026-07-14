import "server-only";

import { and, asc, eq, isNotNull, isNull, lte, or } from "drizzle-orm";

import { db } from "@/db";
import { pushSubscriptions, reminderSettings } from "@/db/schema";
import { nextReminderAt } from "@/lib/reminders";
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
} from "./reminder-delivery-operations";
import { requireUserId } from "./session";

/**
 * Data access for notifications (PRD 17): the single optional daily reminder
 * (reminder_setting) and Web Push subscriptions (push_subscription).
 *
 * Two groups of functions:
 *   - User-scoped: call requireUserId() and only touch the session user's own rows.
 *   - System-scoped: take an explicit userId / no session, for the guarded reminder-send
 *     job (a scheduled trigger, not an interactive request). These must never be exposed
 *     to the client without the cron secret guard on the send route.
 */

export type ReminderSettings = {
  isEnabled: boolean;
  /** Local time-of-day "HH:MM" for the daily reminder, or null if never set. */
  reminderTime: string | null;
  timezone: string;
};

/** The JSON shape a browser PushSubscription serializes to. */
export type WebPushSubscriptionJSON = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

const DEFAULT_REMINDER: ReminderSettings = {
  isEnabled: false,
  reminderTime: null,
  timezone: "UTC",
};

// ---- User-scoped ---------------------------------------------------------------------

/** The current user's reminder settings, or sensible defaults if they have none yet. */
export async function getReminderSettings(): Promise<ReminderSettings> {
  const userId = await requireUserId();
  const [row] = await db
    .select()
    .from(reminderSettings)
    .where(eq(reminderSettings.userId, userId))
    .limit(1);
  if (!row) return DEFAULT_REMINDER;
  return {
    isEnabled: row.isEnabled,
    reminderTime: row.reminderTime,
    timezone: row.timezone,
  };
}

/** Creates or updates the current user's single daily reminder. */
export async function upsertReminderSettings(input: ReminderSettings): Promise<void> {
  const userId = await requireUserId();
  const nextAt =
    input.isEnabled && input.reminderTime
      ? nextReminderAt(input.reminderTime, input.timezone)
      : null;
  await db
    .insert(reminderSettings)
    .values({
      userId,
      isEnabled: input.isEnabled,
      reminderTime: input.reminderTime,
      timezone: input.timezone,
      nextReminderAt: nextAt,
    })
    .onConflictDoUpdate({
      target: reminderSettings.userId,
      set: {
        isEnabled: input.isEnabled,
        reminderTime: input.reminderTime,
        timezone: input.timezone,
        nextReminderAt: nextAt,
        deliveryLocalDate: null,
        deliveryLeaseToken: null,
        deliveryLeaseExpiresAt: null,
        updatedAt: new Date(),
      },
    });
}

/** Keeps an enabled reminder aligned with the browser's current IANA timezone. */
export async function updateReminderTimezone(timezone: string): Promise<void> {
  const userId = await requireUserId();
  await db
    .update(reminderSettings)
    .set({
      timezone,
      nextReminderAt: null,
      deliveryLocalDate: null,
      deliveryLeaseToken: null,
      deliveryLeaseExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(reminderSettings.userId, userId), eq(reminderSettings.isEnabled, true)));
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
export async function deleteMyPushSubscription(endpoint: string): Promise<void> {
  const userId = await requireUserId();
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

/** All push subscriptions belonging to the current user (e.g. for a test send). */
export async function listMyPushSubscriptions() {
  const userId = await requireUserId();
  return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
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
      userId: reminderSettings.userId,
      reminderTime: reminderSettings.reminderTime,
      timezone: reminderSettings.timezone,
      nextReminderAt: reminderSettings.nextReminderAt,
      deliveryLocalDate: reminderSettings.deliveryLocalDate,
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
            userId: r.userId,
            reminderTime: r.reminderTime,
            timezone: r.timezone,
            nextReminderAt: r.nextReminderAt,
            deliveryLocalDate: r.deliveryLocalDate,
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
  now: Date,
  leaseDurationMs: number,
): Promise<string | null> {
  return claimReminderDeliveryLease(db, reminder, localDate, now, leaseDurationMs);
}

export async function releaseReminderDelivery(
  userId: string,
  localDate: string,
  token: string,
  retryAt: Date,
): Promise<boolean> {
  return releaseReminderDeliveryLease(db, userId, localDate, token, retryAt);
}

/** Marks the claimed local date complete and advances its persisted UTC schedule. */
export async function completeReminderDelivery(
  userId: string,
  localDate: string,
  token: string,
  nextAt: Date,
): Promise<boolean> {
  return completeReminderDeliveryLease(db, userId, localDate, token, nextAt);
}

export async function listPushSubscriptionsForReminder(
  userId: string,
  localDate: string,
  limit: number,
) {
  return listPendingReminderSubscriptions(db, userId, localDate, limit);
}

export async function hasPendingPushSubscriptionsForReminder(
  userId: string,
  localDate: string,
): Promise<boolean> {
  return hasPendingReminderSubscriptions(db, userId, localDate);
}

export async function markPushSubscriptionAttempt(
  subscriptionId: string,
  userId: string,
  localDate: string,
  delivered: boolean,
  attemptedAt: Date,
  maxFailures: number,
): Promise<void> {
  await recordReminderSubscriptionAttempt(
    db,
    subscriptionId,
    userId,
    localDate,
    delivered,
    attemptedAt,
    maxFailures,
  );
}

export async function deletePushSubscriptionForReminder(
  subscriptionId: string,
  userId: string,
): Promise<void> {
  await deleteReminderSubscription(db, subscriptionId, userId);
}
