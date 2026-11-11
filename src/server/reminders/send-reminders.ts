import type { PushSubscription as WebPushSubscription } from "web-push";

import {
  claimReminderDelivery,
  completeReminderDelivery,
  deletePushSubscriptionForReminder,
  disableInvalidReminder,
  hasPendingPushSubscriptionsForReminder,
  listReminderCandidates,
  listPushSubscriptionsForReminder,
  markPushSubscriptionAttempt,
  releaseReminderDelivery,
  renewReminderDelivery,
  scheduleNextReminder,
  purgeExpiredUndoEntries,
  type ReminderCandidate,
} from "@/server/data";
import { evaluateReminder, type ReminderEvaluation } from "@/lib/reminders";
import { errorSummary, logError } from "@/lib/log";
import { isPushConfigured, sendPush } from "@/server/push/webpush";

/**
 * The scheduled reminder send (PRD 17), shared by the Worker's Cron Trigger, which
 * calls it directly (worker/handlers.ts), and the /api/notifications/send route, which
 * keeps it reachable by hand. Calling it from the cron without going through Next.js
 * keeps each five-minute run cheap: no request routing or page code has to load.
 *
 * For each enabled reminder, if the resolved occurrence in its saved timezone is within
 * `windowMinutes` (default 10), we push the gentle daily reminder to all of their
 * subscribed devices and prune any that are gone.
 */

const REMINDER_TITLE = "Ready for a quick check-in?";
const REMINDER_BODY = "Take a moment to record what you did and how you felt.";
const REMINDER_URL = "/today#checkin";
export const DEFAULT_WINDOW_MINUTES = 10;
const MAX_CANDIDATES_PER_RUN = 100;
const SEND_CONCURRENCY = 10;
const MAX_SUBSCRIPTIONS_PER_USER_PER_RUN = 25;
const SUBSCRIPTION_DISPATCH_BATCH_SIZE = 5;
const REMINDER_DELIVERY_LEASE_MS = 2 * 60_000;
const REMINDER_RETRY_DELAY_MS = 60_000;
const MAX_TRANSIENT_FAILURES_PER_SUBSCRIPTION = 3;

export type ReminderSendResult = {
  status: number;
  body: Record<string, unknown>;
};

export async function sendDueReminders({
  windowMinutes = DEFAULT_WINDOW_MINUTES,
  dryRun = false,
}: {
  windowMinutes?: number;
  dryRun?: boolean;
} = {}): Promise<ReminderSendResult> {
  // Housekeeping on the same five-minute clock: expired Undo snapshots go for good.
  await purgeExpiredUndoEntries().catch((error) =>
    logError({
      event: "undo_purge_failed",
      reason: "purge_threw",
      route: "/api/notifications/send",
      error: errorSummary(error),
    }),
  );
  if (!isPushConfigured()) {
    return {
      status: 503,
      body: { ok: false, error: "Web Push is not configured on the server." },
    };
  }

  const now = new Date();

  const candidates = await listReminderCandidates(now, MAX_CANDIDATES_PER_RUN);
  const evaluated: Array<ReminderCandidate & ReminderEvaluation> = [];
  const invalid: ReminderCandidate[] = [];
  for (const reminder of candidates) {
    try {
      const evaluation = evaluateReminder(
        reminder.reminderTime,
        reminder.timezone,
        now,
        windowMinutes,
      );
      evaluated.push({
        ...reminder,
        ...evaluation,
        due: evaluation.due || reminder.deliveryLocalDate !== null,
        localDate: reminder.deliveryLocalDate ?? evaluation.localDate,
        occurrenceAt: reminder.deliveryOccurrenceAt ?? evaluation.occurrenceAt,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        [
          "INVALID_REMINDER_TIME",
          "INVALID_TIMEZONE",
          "UNRESOLVABLE_REMINDER_TIME",
        ].includes(error.message)
      ) {
        invalid.push(reminder);
        continue;
      }
      throw error;
    }
  }
  const due = evaluated.filter((reminder) => reminder.due);
  const dueUsers = new Set(due.map((reminder) => reminder.userId)).size;

  if (dryRun) {
    return {
      status: 200,
      body: {
        ok: true,
        dryRun: true,
        windowMinutes,
        candidates: candidates.length,
        invalidCandidates: invalid.length,
        dueUsers,
        dueReminders: due.length,
        due: due.map((r) => ({
          reminderId: r.id,
          userId: r.userId,
          reminderTime: r.reminderTime,
          timezone: r.timezone,
          localDate: r.localDate,
          occurrenceAt: r.occurrenceAt,
        })),
      },
    };
  }

  let sent = 0;
  let pruned = 0;
  let failed = 0;
  let claimedReminders = 0;
  const disabledInvalid = (
    await Promise.all(invalid.map(disableInvalidReminder))
  ).filter(Boolean).length;
  const notDue = evaluated.filter((reminder) => !reminder.due);
  await Promise.all(
    notDue.map((reminder) => scheduleNextReminder(reminder, reminder.nextAt)),
  );

  async function sendForReminder(reminder: (typeof due)[number]) {
    let userSent = 0;
    let userPruned = 0;
    let userFailed = 0;
    let claimToken: string | null = null;
    let hasPendingSubscriptions = true;
    let ownsLease = true;
    try {
      claimToken = await claimReminderDelivery(
        reminder,
        reminder.localDate,
        reminder.occurrenceAt,
        new Date(),
        REMINDER_DELIVERY_LEASE_MS,
      );
      if (!claimToken) {
        return;
      }
      claimedReminders += 1;

      const subscriptions = await listPushSubscriptionsForReminder(
        reminder.id,
        reminder.userId,
        reminder.occurrenceAt,
        MAX_SUBSCRIPTIONS_PER_USER_PER_RUN,
      );
      for (
        let offset = 0;
        offset < subscriptions.length;
        offset += SUBSCRIPTION_DISPATCH_BATCH_SIZE
      ) {
        ownsLease = await renewReminderDelivery(
          reminder.id,
          reminder.userId,
          reminder.localDate,
          reminder.occurrenceAt,
          claimToken,
          new Date(),
          REMINDER_DELIVERY_LEASE_MS,
        );
        if (!ownsLease) break;

        const results = await Promise.all(
          subscriptions
            .slice(offset, offset + SUBSCRIPTION_DISPATCH_BATCH_SIZE)
            .map(async (subscription) => ({
              subscription,
              result: await sendPush(
                subscription.subscriptionData as unknown as WebPushSubscription,
                {
                  title: REMINDER_TITLE,
                  body: REMINDER_BODY,
                  url: REMINDER_URL,
                },
              ),
            })),
        );
        for (const { subscription, result } of results) {
          const mutatedAt = new Date();
          let mutationApplied: boolean;
          if (result.ok) {
            mutationApplied = await markPushSubscriptionAttempt(
              subscription.id,
              reminder.id,
              reminder.userId,
              reminder.localDate,
              reminder.occurrenceAt,
              claimToken,
              true,
              mutatedAt,
              MAX_TRANSIENT_FAILURES_PER_SUBSCRIPTION,
            );
            userSent += 1;
          } else if (result.gone) {
            mutationApplied = await deletePushSubscriptionForReminder(
              subscription.id,
              reminder.id,
              reminder.userId,
              reminder.localDate,
              reminder.occurrenceAt,
              claimToken,
              mutatedAt,
            );
            userPruned += 1;
          } else {
            mutationApplied = await markPushSubscriptionAttempt(
              subscription.id,
              reminder.id,
              reminder.userId,
              reminder.localDate,
              reminder.occurrenceAt,
              claimToken,
              false,
              mutatedAt,
              MAX_TRANSIENT_FAILURES_PER_SUBSCRIPTION,
            );
            userFailed += 1;
          }
          if (!mutationApplied) ownsLease = false;
        }
        if (!ownsLease) break;
      }
      if (ownsLease) {
        hasPendingSubscriptions = await hasPendingPushSubscriptionsForReminder(
          reminder.id,
          reminder.userId,
          reminder.occurrenceAt,
        );
      }
    } catch {
      userFailed += 1;
    }

    sent += userSent;
    pruned += userPruned;
    failed += userFailed;
    if (!claimToken || !ownsLease) return;
    try {
      const finalizedAt = new Date();
      let finalized: boolean;
      if (hasPendingSubscriptions) {
        finalized = await releaseReminderDelivery(
          reminder.id,
          reminder.userId,
          reminder.localDate,
          reminder.occurrenceAt,
          claimToken,
          finalizedAt,
          new Date(finalizedAt.getTime() + REMINDER_RETRY_DELAY_MS),
        );
      } else {
        finalized = await completeReminderDelivery(
          reminder.id,
          reminder.userId,
          reminder.localDate,
          reminder.occurrenceAt,
          claimToken,
          finalizedAt,
          reminder.nextAt,
        );
      }
      if (!finalized) failed += 1;
    } catch {
      failed += 1;
    }
  }

  for (let offset = 0; offset < due.length; offset += SEND_CONCURRENCY) {
    await Promise.all(
      due.slice(offset, offset + SEND_CONCURRENCY).map(sendForReminder),
    );
  }

  return {
    status: 200,
    body: {
      ok: true,
      candidates: candidates.length,
      disabledInvalid,
      dueUsers,
      dueReminders: due.length,
      claimedReminders,
      sent,
      pruned,
      failed,
    },
  };
}
