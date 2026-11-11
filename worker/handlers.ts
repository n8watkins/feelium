// The Worker's handlers around the OpenNext build of the Next.js app.
//
// scheduled: the Cron Trigger sends due reminders. It calls the delivery code
// (src/server/reminders/send-reminders.ts) directly rather than through the
// Next.js app, so a run every five minutes loads no routing or page code and
// costs a few milliseconds of CPU instead of a cold Next.js request.

import { errorSummary, logError, pathOf } from "../src/lib/log";
import { cheapAnswer, mayUseEdgeCache } from "./edge-cache";

export type FetchHandler = {
  fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response>;
};

/** The cached entrypoint (worker/index.ts), reached through ctx.exports. */
export type CachedPagesExports = {
  exports: { CachedPages: { fetch(request: Request): Promise<Response> } };
};

/** sendDueReminders, passed in by worker/index.ts so the tests can stand in for it. */
export type SendReminders = () => Promise<{ status: number; body: Record<string, unknown> }>;

export async function runReminderCron(sendReminders: SendReminders) {
  const { status, body } = await sendReminders();
  if (status === 503) {
    // Web Push is not configured yet: nothing to send, not a failure.
    console.log(JSON.stringify({ event: "reminder_cron_skipped", status: 503, body }));
    return;
  }
  if (status >= 400) throw new Error(`reminder cron failed with status ${status}`);
  console.log(JSON.stringify({ event: "reminder_cron", ...body }));
}

export function createWorker(app: FetchHandler, sendReminders: SendReminders) {
  return {
    async fetch(request, env, ctx) {
      try {
        const cheap = cheapAnswer(request);
        if (cheap) return cheap;
        if (mayUseEdgeCache(request, new URL(env.AUTH_URL).hostname)) {
          return await (ctx as ExecutionContext & CachedPagesExports).exports.CachedPages.fetch(request);
        }
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

    async scheduled() {
      await runReminderCron(sendReminders);
    },
  } satisfies ExportedHandler<CloudflareEnv>;
}
