import assert from "node:assert/strict";
import test, { mock } from "node:test";

import { authLogger, errorSummary, pathOf, safeMessage } from "@/lib/log";

class CallbackRouteError extends Error {
  type = "CallbackRouteError";
}

test("logs an Auth.js error as one JSON line with its type and a masked message only", () => {
  const error = mock.method(console, "error", () => {});
  try {
    const inner = new Error("Failed query: insert into users values ($1) params: someone@example.com,gho_abcdefghijklmnopqrstuvwxyz012345");
    authLogger.error(
      new CallbackRouteError(`${inner.message}. Read more at https://errors.authjs.dev#callbackrouteerror`, {
        cause: { err: inner, providerId: "github", error: "access_denied", code: "secretcode", state: "secretstate", cookie: "secretcookie" },
      }),
    );
    const line = String(error.mock.calls[0]?.arguments[0]);
    assert.deepEqual(JSON.parse(line), {
      event: "auth_error",
      reason: "CallbackRouteError",
      route: "/api/auth",
      message: "Failed query: insert into users values ($1) params: [redacted]",
      provider: "github",
      providerError: "access_denied",
      cause: "Error",
    });
    for (const secret of ["someone@example.com", "gho_", "secretcode", "secretstate", "secretcookie"]) {
      assert.ok(!line.includes(secret), secret);
    }
  } finally {
    error.mock.restore();
  }
});

test("keeps Auth.js debug silent and logs warnings as a code", () => {
  const log = mock.method(console, "log", () => {});
  const warn = mock.method(console, "warn", () => {});
  try {
    authLogger.debug();
    authLogger.warn("debug-enabled");
    assert.equal(log.mock.callCount(), 0);
    assert.deepEqual(JSON.parse(String(warn.mock.calls[0]?.arguments[0])), {
      event: "auth_warning",
      reason: "debug-enabled",
      route: "/api/auth",
    });
  } finally {
    log.mock.restore();
    warn.mock.restore();
  }
});

test("masks emails and long tokens and drops query strings", () => {
  assert.equal(safeMessage("no user a.b@c.io with token abcdefghijklmnopqrstuvwxyz"), "no user [email] with token [redacted]");
  assert.equal(errorSummary(new TypeError("bad")), "TypeError: bad");
  assert.equal(pathOf("https://x.test/api/auth/callback/github?code=c&state=s"), "/api/auth/callback/github");
});
