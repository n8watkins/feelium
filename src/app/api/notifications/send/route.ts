import { NextResponse, type NextRequest } from "next/server";

import { isCronAuthorized } from "@/lib/cron-auth";
import {
  DEFAULT_WINDOW_MINUTES,
  sendDueReminders,
} from "@/server/reminders/send-reminders";

/**
 * Reminder-send endpoint (PRD 17), for manual runs. The Worker's Cron Trigger calls
 * sendDueReminders directly every five minutes (wrangler.jsonc, worker/handlers.ts); see
 * docs/notifications-and-pwa.md for operations. Requires
 * `Authorization: Bearer <CRON_SECRET>`.
 *
 * Manual/local testing (no cloud):
 *   curl -X POST "http://localhost:3002/api/notifications/send?secret=$CRON_SECRET"
 *   add &dryRun=1 to see who is due without sending, or &window=5 to widen the match.
 */

// Node runtime (web-push needs Node crypto); never cache - this is a scheduled action.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  return isCronAuthorized(
    request.headers.get("authorization"),
    request.nextUrl.searchParams.get("secret"),
    process.env.CRON_SECRET,
    process.env.NODE_ENV === "production",
  );
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  const params = request.nextUrl.searchParams;
  const windowMinutes = Math.max(
    1,
    Math.min(60, Number(params.get("window")) || DEFAULT_WINDOW_MINUTES),
  );
  const dryRun = params.get("dryRun") === "1";
  const { status, body } = await sendDueReminders({ windowMinutes, dryRun });
  return NextResponse.json(body, { status });
}
