// The Worker's handlers around the OpenNext build of the Next.js app.
//
// scheduled: the Cron Trigger sends due reminders. It calls the existing
// /api/notifications/send route in-process through the OpenNext fetch handler
// (no network hop), so the delivery code stays in the Next.js bundle and keeps
// its tests. The route authorizes the call with CRON_SECRET.

import { errorSummary, logError, pathOf } from "../src/lib/log";

export type FetchHandler = {
  fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response>;
};

// Handled in-process, so the host never resolves.
const INTERNAL_HOST = "worker.internal";
export const INTERNAL_SEND_URL = `https://${INTERNAL_HOST}/api/notifications/send`;

export async function runReminderCron(app: FetchHandler, env: CloudflareEnv, ctx: ExecutionContext) {
  if (!env.CRON_SECRET) {
    console.log(JSON.stringify({ event: "reminder_cron_skipped", reason: "CRON_SECRET is not set" }));
    return;
  }
  const request = new Request(INTERNAL_SEND_URL, {
    method: "POST",
    headers: { host: INTERNAL_HOST, authorization: `Bearer ${env.CRON_SECRET}` },
  });
  const response = await app.fetch(request, env, ctx);
  const body: unknown = await response.json().catch(() => null);
  if (response.status === 503) {
    // Web Push is not configured yet: nothing to send, not a failure.
    console.log(JSON.stringify({ event: "reminder_cron_skipped", status: 503, body }));
    return;
  }
  if (!response.ok) throw new Error(`reminder cron failed with status ${response.status}`);
  console.log(JSON.stringify({ event: "reminder_cron", ...(body && typeof body === "object" ? body : {}) }));
}

export function createWorker(app: FetchHandler) {
  return {
    async fetch(request, env, ctx) {
      try {
        return await app.fetch(request, env, ctx);
      } catch (err) {
        // Next reports its own errors (instrumentation onRequestError); this
        // is for a throw that escapes OpenNext itself.
        logError({
          event: "unhandled_exception",
          reason: "worker_fetch_threw",
          route: pathOf(request.url),
          method: request.method,
          status: 500,
          error: errorSummary(err),
        });
        throw err;
      }
    },

    async scheduled(_controller, env, ctx) {
      await runReminderCron(app, env, ctx);
    },
  } satisfies ExportedHandler<CloudflareEnv>;
}
