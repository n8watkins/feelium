import "server-only";

import { and, asc, eq, isNotNull, isNull, lte, ne, or } from "drizzle-orm";

import { db } from "@/db";
import { pushSubscriptions, reminderSettings } from "@/db/schema";
import { nextReminderAt } from "@/lib/reminders";
import {
  disableInvalidReminderSchedule,
  reminderScheduleCondition,
  type ReminderCandidate,
} from "./reminder-operations";
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
        updatedAt: new Date(),
      },
    });
}

/** Keeps an enabled reminder aligned with the browser's current IANA timezone. */
export async function updateReminderTimezone(timezone: string): Promise<void> {
  const userId = await requireUserId();
  await db
    .update(reminderSettings)
    .set({ timezone, nextReminderAt: null, updatedAt: new Date() })
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
      set: { subscriptionData: data, lastUsedAt: new Date() },
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
): Promise<boolean> {
  const rows = await db
    .update(reminderSettings)
    .set({ lastSentLocalDate: localDate, updatedAt: new Date() })
    .where(
      and(
        reminderScheduleCondition(reminder),
        or(
          isNull(reminderSettings.lastSentLocalDate),
          ne(reminderSettings.lastSentLocalDate, localDate),
        ),
      ),
    )
    .returning({ id: reminderSettings.id });
  return rows.length === 1;
}

/** Allows a later cron invocation to retry after an entirely transient delivery failure. */
export async function releaseReminderDelivery(
  reminder: ReminderCandidate,
  localDate: string,
  retryAt: Date,
): Promise<void> {
  await db
    .update(reminderSettings)
    .set({
      lastSentLocalDate: null,
      nextReminderAt: retryAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        reminderScheduleCondition(reminder),
        eq(reminderSettings.lastSentLocalDate, localDate),
      ),
    );
}

/** Marks the claimed local date complete and advances its persisted UTC schedule. */
export async function completeReminderDelivery(
  reminder: ReminderCandidate,
  localDate: string,
  nextAt: Date,
): Promise<void> {
  await db
    .update(reminderSettings)
    .set({ nextReminderAt: nextAt, updatedAt: new Date() })
    .where(
      and(
        reminderScheduleCondition(reminder),
        eq(reminderSettings.lastSentLocalDate, localDate),
      ),
    );
}

/** Push subscriptions for a given user (system context - no session). */
export async function listPushSubscriptionsForUser(userId: string) {
  return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}

/** Prunes a dead subscription (system context) after a 404/410 from the push service. */
export async function deletePushSubscriptionByEndpoint(endpoint: string): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}
