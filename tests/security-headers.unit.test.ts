import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest, type NextFetchEvent } from "next/server";

import { buildContentSecurityPolicy } from "@/lib/security-headers";

test("only upgrades insecure requests in production", () => {
  assert.doesNotMatch(
    buildContentSecurityPolicy("development-nonce", true),
    /upgrade-insecure-requests/,
  );
  assert.match(
    buildContentSecurityPolicy("production-nonce", false),
    /upgrade-insecure-requests/,
  );
});

test("production scripts require the request nonce", () => {
  const policy = buildContentSecurityPolicy("unique-request-nonce", false);
  const scriptPolicy = policy
    .split("; ")
    .find((directive) => directive.startsWith("script-src"));

  assert.equal(
    scriptPolicy,
    "script-src 'self' 'nonce-unique-request-nonce' 'strict-dynamic'",
  );
  assert.doesNotMatch(scriptPolicy, /'unsafe-inline'/);
  assert.doesNotMatch(scriptPolicy, /'unsafe-eval'/);
});

test("development supports local HTTP assets without weakening script nonces", () => {
  const policy = buildContentSecurityPolicy("local-request-nonce", true);

  assert.match(policy, /script-src [^;]*'nonce-local-request-nonce'/);
  assert.match(policy, /script-src [^;]*'unsafe-eval'/);
  assert.doesNotMatch(
    policy.split("; ").find((directive) => directive.startsWith("script-src")),
    /'unsafe-inline'/,
  );
  assert.match(policy, /connect-src 'self' ws: http:/);
});

test("proxy forwards one nonce policy to Next.js and the browser", async () => {
  process.env.AUTH_SECRET = "security-header-test-secret";
  const { default: proxy } = await import("@/proxy");
  const event = {
    waitUntil() {},
    passThroughOnException() {},
  } as unknown as NextFetchEvent;

  const response = await proxy(new NextRequest("https://example.test/login"), event);
  const browserPolicy = response.headers.get("Content-Security-Policy");
  const renderPolicy = response.headers.get(
    "x-middleware-request-content-security-policy",
  );

  assert.ok(browserPolicy);
  assert.equal(renderPolicy, browserPolicy);
  assert.match(browserPolicy, /script-src [^;]*'nonce-[^']+'/);
  assert.doesNotMatch(
    browserPolicy.split("; ").find((directive) => directive.startsWith("script-src")),
    /'unsafe-inline'/,
  );
});
