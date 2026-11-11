import assert from "node:assert/strict";
import { test } from "node:test";

import { cheapAnswer, forEdge, mayUseEdgeCache } from "./edge-cache";

const host = "feelium.n8builds.dev";
const at = (path: string, init?: RequestInit) => new Request(`https://${host}${path}`, init);

test("signed-out visitors and everyone's share images may use the cache", () => {
  assert.equal(mayUseEdgeCache(at("/"), host), true);
  assert.equal(mayUseEdgeCache(at("/privacy", { method: "HEAD" }), host), true);
  const signedIn = { headers: { cookie: "theme=dark; __Secure-authjs.session-token.0=x" } };
  assert.equal(mayUseEdgeCache(at("/opengraph-image", signedIn), host), true);
  assert.equal(mayUseEdgeCache(at("/", signedIn), host), false);
});

test("app screens, other hosts, posts and client navigations never use it", () => {
  assert.equal(mayUseEdgeCache(at("/today"), host), false);
  assert.equal(mayUseEdgeCache(at("/login"), host), false);
  assert.equal(mayUseEdgeCache(new Request("https://feelium.example.workers.dev/"), host), false);
  assert.equal(mayUseEdgeCache(at("/", { method: "POST" }), host), false);
  assert.equal(mayUseEdgeCache(at("/", { headers: { rsc: "1" } }), host), false);
  assert.equal(mayUseEdgeCache(at("/", { headers: { authorization: "Bearer x" } }), host), false);
});

test("a landing page is kept without Auth.js's sign-in helper cookies", () => {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  headers.append("Set-Cookie", "__Host-authjs.csrf-token=abc; Path=/; HttpOnly; Secure");
  headers.append("Set-Cookie", "__Secure-authjs.callback-url=https%3A%2F%2Ffeelium; Path=/");
  const marked = forEdge(at("/"), new Response("<html>", { headers }));
  assert.match(marked.headers.get("Cloudflare-CDN-Cache-Control") ?? "", /^public, max-age=3600,/);
  assert.equal(marked.headers.get("Set-Cookie"), null);
  assert.equal(marked.headers.get("Cache-Control"), "private, no-store");
});

test("a response with any other cookie, or that is not a 200, is never kept", () => {
  const session = new Response("<html>", {
    headers: { "Set-Cookie": "__Secure-authjs.session-token=abc; Path=/" },
  });
  const sessionMarked = forEdge(at("/"), session);
  assert.equal(sessionMarked.headers.get("Cloudflare-CDN-Cache-Control"), "no-store");
  assert.notEqual(sessionMarked.headers.get("Set-Cookie"), null);
  const redirect = forEdge(at("/"), new Response(null, { status: 307, headers: { Location: "/today" } }));
  assert.equal(redirect.headers.get("Cloudflare-CDN-Cache-Control"), "no-store");
});

test("the uptime check and scanner probes get a plain answer; real paths get none", () => {
  assert.equal(cheapAnswer(at("/healthz"))?.status, 200);
  for (const path of ["/.env", "/.git/config", "/wp-admin/install.php", "/config/app.php"]) {
    assert.equal(cheapAnswer(at(path))?.status, 404, path);
  }
  for (const path of ["/", "/.well-known/security.txt", "/today", "/settings/behaviors/x"]) {
    assert.equal(cheapAnswer(at(path)), null, path);
  }
});
