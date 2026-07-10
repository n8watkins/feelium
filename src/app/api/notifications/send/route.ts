import type { PushSubscription as WebPushSubscription } from "web-push";

import { NextResponse, type NextRequest } from "next/server";

import {
  deletePushSubscriptionByEndpoint,
  listEnabledReminders,
  listPushSubscriptionsForUser,
} from "@/server/data";
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
 * timezone matches their reminder time (within `window` minutes, default 1), we push the
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
  return request.nextUrl.searchParams.get("secret") === secret;
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
  const windowMinutes = Math.max(1, Math.min(60, Number(params.get("window")) || 1));
  const dryRun = params.get("dryRun") === "1";
  const now = new Date();

  const reminders = await listEnabledReminders();
  const due = reminders.filter((r) => {
    const nowHHMM = currentHHMM(r.timezone, now);
    return nowHHMM !== null && isDue(r.reminderTime, nowHHMM, windowMinutes);
  });

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      windowMinutes,
      dueUsers: due.length,
      due: due.map((r) => ({ userId: r.userId, reminderTime: r.reminderTime, timezone: r.timezone })),
    });
  }

  let sent = 0;
  let pruned = 0;
  let failed = 0;
  for (const reminder of due) {
    const subs = await listPushSubscriptionsForUser(reminder.userId);
    for (const sub of subs) {
      const result = await sendPush(sub.subscriptionData as unknown as WebPushSubscription, {
        title: REMINDER_TITLE,
        body: REMINDER_BODY,
        url: REMINDER_URL,
      });
      if (result.ok) {
        sent += 1;
      } else if (result.gone) {
        await deletePushSubscriptionByEndpoint(sub.endpoint);
        pruned += 1;
      } else {
        failed += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, dueUsers: due.length, sent, pruned, failed });
}

export async function POST(request: NextRequest) {
  return handle(request);
}

// Vercel Cron issues GET requests, so support both verbs.
export async function GET(request: NextRequest) {
  return handle(request);
}
