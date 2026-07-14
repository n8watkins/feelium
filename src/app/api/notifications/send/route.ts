import type { PushSubscription as WebPushSubscription } from "web-push";

import { NextResponse, type NextRequest } from "next/server";

import {
  claimReminderDelivery,
  completeReminderDelivery,
  deletePushSubscriptionByEndpoint,
  listReminderCandidates,
  listPushSubscriptionsForUser,
  releaseReminderDelivery,
  scheduleNextReminder,
} from "@/server/data";
import { addDaysISO, dateISOInTimeZone } from "@/lib/date";
import { nextReminderAt } from "@/lib/reminders";
import { isPushConfigured, sendPush } from "@/server/push/webpush";

/**
 * Scheduled reminder-send endpoint (PRD 17).
 *
 * PRODUCTION: a scheduled trigger (e.g. a Vercel Cron running every minute) calls this
 * endpoint. Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>`; we
 * verify it against the CRON_SECRET env var. Nothing here builds cloud infra - it is just
 * the HTTP entry point a scheduler drives. Example vercel.json:
 *   { "crons": [{ "path": "/api/notifications/send", "schedule": "* * * * *" }] }
 *
 * For each user with the reminder enabled, if the current wall-clock time in their saved
 * timezone matches their reminder time (within `window` minutes, default 10), we push the
 * gentle daily reminder to all of their subscribed devices and prune any that are gone.
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
const SUBSCRIPTION_CONCURRENCY_PER_USER = 25;

/** Current wall-clock "HH:MM" in the given IANA timezone, or null if the tz is invalid. */
function currentHHMM(timezone: string, now: Date): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const hh = parts.find((p) => p.type === "hour")?.value;
    const mm = parts.find((p) => p.type === "minute")?.value;
    if (hh == null || mm == null) return null;
    return `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}`;
  } catch {
    return null;
  }
}

function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** True when `now` is within [reminder, reminder + window) minutes (handles midnight wrap). */
function isDue(reminderTime: string, nowHHMM: string, windowMinutes: number): boolean {
  const diff = (minutesOfDay(nowHHMM) - minutesOfDay(reminderTime) + 1440) % 1440;
  return diff < windowMinutes;
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never allow when unconfigured
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return (
    process.env.NODE_ENV !== "production" && request.nextUrl.searchParams.get("secret") === secret
  );
}

function deliveryDate(reminderTime: string, nowHHMM: string, timezone: string, now: Date): string {
  const localDate = dateISOInTimeZone(now, timezone);
  return minutesOfDay(nowHHMM) < minutesOfDay(reminderTime)
    ? addDaysISO(localDate, -1)
    : localDate;
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
  const evaluated = candidates.flatMap((r) => {
    const nowHHMM = currentHHMM(r.timezone, now);
    if (nowHHMM === null) return [];
    return [
      {
        ...r,
        due: isDue(r.reminderTime, nowHHMM, windowMinutes),
        localDate: deliveryDate(r.reminderTime, nowHHMM, r.timezone, now),
        nextAt: nextReminderAt(r.reminderTime, r.timezone, now),
      },
    ];
  });
  const due = evaluated.filter((reminder) => reminder.due);

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      windowMinutes,
      candidates: candidates.length,
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
  const notDue = evaluated.filter((reminder) => !reminder.due);
  await Promise.all(
    notDue.map((reminder) => scheduleNextReminder(reminder, reminder.nextAt)),
  );

  async function sendForUser(reminder: (typeof due)[number]) {
    let userSent = 0;
    let userPruned = 0;
    let userFailed = 0;
    let claimed = false;
    try {
      claimed = await claimReminderDelivery(reminder, reminder.localDate);
      if (!claimed) {
        await scheduleNextReminder(reminder, reminder.nextAt);
        return;
      }
      claimedUsers += 1;

      const subscriptions = await listPushSubscriptionsForUser(reminder.userId);
      for (
        let offset = 0;
        offset < subscriptions.length;
        offset += SUBSCRIPTION_CONCURRENCY_PER_USER
      ) {
        const batch = subscriptions.slice(
          offset,
          offset + SUBSCRIPTION_CONCURRENCY_PER_USER,
        );
        const results = await Promise.all(
          batch.map(async (subscription) => ({
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
            userSent += 1;
          } else if (result.gone) {
            await deletePushSubscriptionByEndpoint(subscription.endpoint);
            userPruned += 1;
          } else {
            userFailed += 1;
          }
        }
      }
    } catch {
      userFailed += 1;
    }

    sent += userSent;
    pruned += userPruned;
    failed += userFailed;
    if (!claimed) return;
    try {
      if (userFailed > 0 && userSent === 0 && userPruned === 0) {
        await releaseReminderDelivery(
          reminder,
          reminder.localDate,
          new Date(Date.now() + 60_000),
        );
      } else {
        await completeReminderDelivery(reminder, reminder.localDate, reminder.nextAt);
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
