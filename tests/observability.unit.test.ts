import assert from "node:assert/strict";
import test from "node:test";

import { isAppPath } from "@/lib/app-paths";
import { scrubEvent, sentryOrigin, stripQuery } from "@/lib/error-reporting";
import { buildContentSecurityPolicy } from "@/lib/security-headers";

function connectSrc(policy: string) {
  return policy.split("; ").find((directive) => directive.startsWith("connect-src"));
}

test("only the app's own screens need a session; unknown paths reach the 404", () => {
  for (const path of ["/today", "/history/2026-11-01", "/settings", "/settings/outcomes", "/checkin/new", "/insights", "/onboarding"]) {
    assert.equal(isAppPath(path), true, path);
  }
  for (const path of ["/", "/login", "/privacy", "/nope", "/todays", "/settingsx", "/wp-admin"]) {
    assert.equal(isAppPath(path), false, path);
  }
});

test("the CSP allows the analytics and Sentry hosts only when they are switched on", () => {
  assert.equal(connectSrc(buildContentSecurityPolicy("n", false)), "connect-src 'self'");
  assert.equal(
    connectSrc(
      buildContentSecurityPolicy("n", false, {
        webAnalytics: true,
        sentryOrigin: sentryOrigin("https://abc123@o42.ingest.us.sentry.io/7"),
      }),
    ),
    "connect-src 'self' https://cloudflareinsights.com https://o42.ingest.us.sentry.io",
  );
});

test("a Sentry DSN gives its ingest origin, never its key", () => {
  assert.equal(sentryOrigin("https://abc123@o42.ingest.us.sentry.io/7"), "https://o42.ingest.us.sentry.io");
  assert.equal(sentryOrigin(undefined), null);
  assert.equal(sentryOrigin("not a url"), null);
  assert.equal(sentryOrigin("http://abc@insecure.example/1"), null);
});

test("Sentry events carry no person, cookies, headers, bodies or query strings", () => {
  const event = scrubEvent({
    user: { id: "u1", email: "me@example.com", ip_address: "1.2.3.4" },
    request: {
      url: "https://feelium.n8builds.dev/history/2026-11-01?next=%2Ftoday#x",
      query_string: "next=%2Ftoday",
      cookies: { "authjs.session-token": "secret" },
      headers: { cookie: "secret", authorization: "Bearer x" },
      data: { note: "private" },
    },
    breadcrumbs: [{ data: { url: "/api/account/export?token=1", from: "/a?b=c", to: "/d#e" } }],
  });
  assert.equal(event.user, undefined);
  assert.deepEqual(event.request, { url: "https://feelium.n8builds.dev/history/2026-11-01" });
  assert.deepEqual(event.breadcrumbs?.[0].data, { url: "/api/account/export", from: "/a", to: "/d" });
  assert.equal(stripQuery("/x?y#z"), "/x");
});
