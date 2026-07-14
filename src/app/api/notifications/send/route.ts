import type { PushSubscription as WebPushSubscription } from "web-push";

import { NextResponse, type NextRequest } from "next/server";

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
  scheduleNextReminder,
  type ReminderCandidate,
} from "@/server/data";
import { evaluateReminder, type ReminderEvaluation } from "@/lib/reminders";
import { isPushConfigured, sendPush } from "@/server/push/webpush";

/**
 * Scheduled reminder-send endpoint (PRD 17).
 *
 * PRODUCTION: the committed Vercel Cron schedule calls this endpoint every minute.
 * Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>`; we verify it
 * against the CRON_SECRET env var. See docs/notifications-and-pwa.md for operations.
 *
 * For each user with the reminder enabled, if the resolved occurrence in their saved
 * timezone is within `window` minutes (default 10), we push the gentle daily reminder to
 * all of their subscribed devices and prune any that are gone.
 *
 * Manual/local testing (no cloud):
 *   curl -X POST "http://localhost:3002/api/notifications/send?secret=$CRON_SECRET"
 *   add &dryRun=1 to see who is due without sending, or &window=5 to widen the match.
 */

// Node runtime (web-push needs Node crypto); never cache - this is a scheduled action.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REMINDER_TITLE = "Ready for a quick check-in?";
const REMINDER_BODY = "Take a moment to record what you did and how you felt.";
const REMINDER_URL = "/checkin/new";
const DEFAULT_WINDOW_MINUTES = 10;
const MAX_CANDIDATES_PER_RUN = 100;
const SEND_CONCURRENCY = 10;
const MAX_SUBSCRIPTIONS_PER_USER_PER_RUN = 25;
const REMINDER_DELIVERY_LEASE_MS = 2 * 60_000;
const REMINDER_RETRY_DELAY_MS = 60_000;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never allow when unconfigured
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return (
    process.env.NODE_ENV !== "production" && request.nextUrl.searchParams.get("secret") === secret
  );
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!isPushConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Web Push is not configured on the server." },
      { status: 503 },
    );
  }

  const params = request.nextUrl.searchParams;
  const windowMinutes = Math.max(
    1,
    Math.min(60, Number(params.get("window")) || DEFAULT_WINDOW_MINUTES),
  );
  const dryRun = params.get("dryRun") === "1";
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

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      windowMinutes,
      candidates: candidates.length,
      invalidCandidates: invalid.length,
      dueUsers: due.length,
      due: due.map((r) => ({
        userId: r.userId,
        reminderTime: r.reminderTime,
        timezone: r.timezone,
        localDate: r.localDate,
      })),
    });
  }

  let sent = 0;
  let pruned = 0;
  let failed = 0;
  let claimedUsers = 0;
  const disabledInvalid = (await Promise.all(invalid.map(disableInvalidReminder))).filter(
    Boolean,
  ).length;
  const notDue = evaluated.filter((reminder) => !reminder.due);
  await Promise.all(
    notDue.map((reminder) => scheduleNextReminder(reminder, reminder.nextAt)),
  );

  async function sendForUser(reminder: (typeof due)[number]) {
    let userSent = 0;
    let userPruned = 0;
    let userFailed = 0;
    let claimToken: string | null = null;
    let hasPendingSubscriptions = true;
    try {
      claimToken = await claimReminderDelivery(
        reminder,
        reminder.localDate,
        new Date(),
        REMINDER_DELIVERY_LEASE_MS,
      );
      if (!claimToken) {
        return;
      }
      claimedUsers += 1;

      const subscriptions = await listPushSubscriptionsForReminder(
        reminder.userId,
        reminder.localDate,
        MAX_SUBSCRIPTIONS_PER_USER_PER_RUN,
      );
      const results = await Promise.all(
        subscriptions.map(async (subscription) => ({
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
        if (result.ok) {
          await markPushSubscriptionAttempt(
            subscription.id,
            reminder.userId,
            reminder.localDate,
            true,
            new Date(),
          );
          userSent += 1;
        } else if (result.gone) {
          await deletePushSubscriptionForReminder(subscription.id, reminder.userId);
          userPruned += 1;
        } else {
          await markPushSubscriptionAttempt(
            subscription.id,
            reminder.userId,
            reminder.localDate,
            false,
            new Date(),
          );
          userFailed += 1;
        }
      }
      hasPendingSubscriptions = await hasPendingPushSubscriptionsForReminder(
        reminder.userId,
        reminder.localDate,
      );
    } catch {
      userFailed += 1;
    }

    sent += userSent;
    pruned += userPruned;
    failed += userFailed;
    if (!claimToken) return;
    try {
      if (hasPendingSubscriptions) {
        await releaseReminderDelivery(
          reminder.userId,
          reminder.localDate,
          claimToken,
          new Date(Date.now() + REMINDER_RETRY_DELAY_MS),
        );
      } else {
        await completeReminderDelivery(
          reminder.userId,
          reminder.localDate,
          claimToken,
          reminder.nextAt,
        );
      }
    } catch {
      failed += 1;
    }
  }

  for (let offset = 0; offset < due.length; offset += SEND_CONCURRENCY) {
    await Promise.all(due.slice(offset, offset + SEND_CONCURRENCY).map(sendForUser));
  }

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    disabledInvalid,
    dueUsers: due.length,
    claimedUsers,
    sent,
    pruned,
    failed,
  });
}

export async function POST(request: NextRequest) {
  return handle(request);
}

// Vercel Cron issues GET requests, so support both verbs.
export async function GET(request: NextRequest) {
  return handle(request);
}
