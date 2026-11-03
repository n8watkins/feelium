import { and, desc, eq, isNull, lte, notInArray, or } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "@/db/schema";
import { profiles, pushSubscriptions } from "@/db/schema";
import {
  MAX_PUSH_SUBSCRIPTIONS_PER_USER,
  TEST_PUSH_INTERVAL_MS,
} from "@/lib/push-endpoints";

/**
 * Session-free push subscription writes, so integration tests can run them against a
 * scratch database (see ./notifications for the session-scoped wrappers).
 */
type Database = LibSQLDatabase<typeof schema>;

export type PushSubscriptionInput = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

/**
 * Stores or refreshes one browser's subscription, then keeps only the user's most
 * recently used MAX_PUSH_SUBSCRIPTIONS_PER_USER, so an account cannot pile up endpoints.
 */
export async function savePushSubscriptionForUser(
  database: Database,
  userId: string,
  subscription: PushSubscriptionInput,
  deviceName: string | null,
  now: Date,
  limit = MAX_PUSH_SUBSCRIPTIONS_PER_USER,
): Promise<void> {
  const data = subscription as unknown as Record<string, unknown>;
  await database
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint: subscription.endpoint,
      subscriptionData: data,
      deviceName,
      lastUsedAt: now,
    })
    .onConflictDoUpdate({
      target: [pushSubscriptions.userId, pushSubscriptions.endpoint],
      set: {
        subscriptionData: data,
        deviceName,
        lastUsedAt: now,
        reminderFailureCount: 0,
        reminderQuarantinedAt: null,
      },
    });

  const keep = await database
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .orderBy(desc(pushSubscriptions.lastUsedAt), desc(pushSubscriptions.createdAt))
    .limit(limit);
  await database.delete(pushSubscriptions).where(
    and(
      eq(pushSubscriptions.userId, userId),
      notInArray(
        pushSubscriptions.id,
        keep.map((row) => row.id),
      ),
    ),
  );
}

/** One of the user's own subscriptions, by its endpoint. */
export async function findPushSubscriptionForUser(
  database: Database,
  userId: string,
  endpoint: string,
) {
  const [row] = await database
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
    .limit(1);
  return row ?? null;
}

/**
 * Atomically takes the user's test-reminder slot: true at most once per
 * TEST_PUSH_INTERVAL_MS, false while the last test is more recent than that.
 */
export async function claimTestPushForUser(
  database: Database,
  userId: string,
  now: Date,
  intervalMs = TEST_PUSH_INTERVAL_MS,
): Promise<boolean> {
  const rows = await database
    .update(profiles)
    .set({ lastTestPushAt: now })
    .where(
      and(
        eq(profiles.userId, userId),
        or(
          isNull(profiles.lastTestPushAt),
          lte(profiles.lastTestPushAt, new Date(now.getTime() - intervalMs)),
        ),
      ),
    )
    .returning({ userId: profiles.userId });
  return rows.length === 1;
}
