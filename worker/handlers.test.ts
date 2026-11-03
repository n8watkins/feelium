import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

import { createWorker, INTERNAL_SEND_URL, type FetchHandler } from "./handlers";

// The OpenNext handler is a build artifact, so the test stands in for it and
// checks what the cron handler asks of it.
let responder: () => Response = () => Response.json({ ok: true });
const calls: { request: Request; env: unknown; ctx: unknown }[] = [];
const openNext = {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    calls.push({ request, env, ctx });
    return responder();
  },
};
const ctx = { waitUntil() {}, passThroughOnException() {}, props: {} };

// The handlers are typed against the Workers runtime; the fakes above only
// carry the fields they read.
type Handlers = {
  fetch(request: Request, env: unknown, ctx: unknown): Promise<Response>;
  scheduled(controller: unknown, env: unknown, ctx: unknown): Promise<void>;
};
const handlers = createWorker(openNext as unknown as FetchHandler) as unknown as Handlers;
const controller = { cron: "2-57/5 * * * *", scheduledTime: Date.now(), noRetry() {} };

beforeEach(() => {
  calls.length = 0;
  mock.method(console, "log", () => undefined);
});

test("the cron handler POSTs to the reminder route in-process with the cron secret", async () => {
  responder = () => Response.json({ ok: true, candidates: 2, dueReminders: 1, sent: 1, pruned: 0, failed: 0 });
  const env = { CRON_SECRET: "cron-secret" };
  await handlers.scheduled(controller, env, ctx);
  assert.equal(calls.length, 1);
  const [{ request, env: passedEnv, ctx: passedCtx }] = calls;
  assert.equal(request.url, INTERNAL_SEND_URL);
  assert.equal(request.method, "POST");
  assert.equal(request.headers.get("authorization"), "Bearer cron-secret");
  assert.equal(passedEnv, env);
  assert.equal(passedCtx, ctx);
});

test("the cron handler does nothing while CRON_SECRET is not set", async () => {
  await handlers.scheduled(controller, {}, ctx);
  assert.equal(calls.length, 0);
});

test("an unconfigured deployment (503) is nothing to send", async () => {
  responder = () => Response.json({ ok: false }, { status: 503 });
  await handlers.scheduled(controller, { CRON_SECRET: "cron-secret" }, ctx);
});

test("a failed delivery run fails the cron invocation so it shows in the Worker logs", async () => {
  responder = () => Response.json({ ok: false }, { status: 500 });
  await assert.rejects(handlers.scheduled(controller, { CRON_SECRET: "cron-secret" }, ctx), /status 500/);
});

test("every request goes to the Next.js app", async () => {
  const response = new Response("ok");
  responder = () => response;
  const request = new Request("https://feelium.example/login");
  assert.equal(await handlers.fetch(request, {}, ctx), response);
  assert.equal(calls[0].request, request);
});
