import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

import { createWorker, type FetchHandler, type SendReminders } from "./handlers";

// The OpenNext handler and the reminder send are stand-ins: the test checks what the
// handlers ask of them.
let responder: () => Response = () => new Response("ok");
const calls: { request: Request; env: unknown; ctx: unknown }[] = [];
const openNext = {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    calls.push({ request, env, ctx });
    return responder();
  },
};
let sendResult: Awaited<ReturnType<SendReminders>> = { status: 200, body: { ok: true } };
let sends = 0;
const sendReminders: SendReminders = async () => {
  sends += 1;
  return sendResult;
};
const cachedCalls: Request[] = [];
const ctx = {
  waitUntil() {},
  passThroughOnException() {},
  props: {},
  exports: {
    CachedPages: {
      async fetch(request: Request) {
        cachedCalls.push(request);
        return new Response("cached");
      },
    },
  },
};
const env = { AUTH_URL: "https://feelium.n8builds.dev" };

// The handlers are typed against the Workers runtime; the fakes above only
// carry the fields they read.
type Handlers = {
  fetch(request: Request, env: unknown, ctx: unknown): Promise<Response>;
  scheduled(controller: unknown, env: unknown, ctx: unknown): Promise<void>;
};
const handlers = createWorker(
  openNext as unknown as FetchHandler,
  sendReminders,
) as unknown as Handlers;
const controller = { cron: "2-57/5 * * * *", scheduledTime: Date.now(), noRetry() {} };

beforeEach(() => {
  calls.length = 0;
  cachedCalls.length = 0;
  sends = 0;
  mock.method(console, "log", () => undefined);
});

test("the cron handler sends due reminders directly, without a request to Next.js", async () => {
  sendResult = { status: 200, body: { ok: true, candidates: 2, dueReminders: 1, sent: 1 } };
  await handlers.scheduled(controller, env, ctx);
  assert.equal(sends, 1);
  assert.equal(calls.length, 0);
});

test("an unconfigured deployment (503) is nothing to send", async () => {
  sendResult = { status: 503, body: { ok: false } };
  await handlers.scheduled(controller, env, ctx);
});

test("a failed delivery run fails the cron invocation so it shows in the Worker logs", async () => {
  sendResult = { status: 500, body: { ok: false } };
  await assert.rejects(handlers.scheduled(controller, env, ctx), /status 500/);
});

test("app pages go to the Next.js app", async () => {
  const response = new Response("ok");
  responder = () => response;
  const request = new Request("https://feelium.n8builds.dev/login");
  assert.equal(await handlers.fetch(request, env, ctx), response);
  assert.equal(calls[0].request, request);
  assert.equal(cachedCalls.length, 0);
});

test("a signed-out visit to the landing page goes to the cached entrypoint", async () => {
  const request = new Request("https://feelium.n8builds.dev/");
  assert.equal(await (await handlers.fetch(request, env, ctx)).text(), "cached");
  assert.equal(calls.length, 0);
});

test("a signed-in visit to the landing page reaches Next.js, which sends it to Today", async () => {
  const request = new Request("https://feelium.n8builds.dev/", {
    headers: { cookie: "__Secure-authjs.session-token=abc" },
  });
  await handlers.fetch(request, env, ctx);
  assert.equal(calls.length, 1);
  assert.equal(cachedCalls.length, 0);
});

test("the uptime check and scanners never reach Next.js", async () => {
  const health = await handlers.fetch(new Request("https://feelium.n8builds.dev/healthz"), env, ctx);
  assert.equal(health.status, 200);
  const probe = await handlers.fetch(new Request("https://feelium.n8builds.dev/.env"), env, ctx);
  assert.equal(probe.status, 404);
  assert.equal(calls.length + cachedCalls.length, 0);
});
