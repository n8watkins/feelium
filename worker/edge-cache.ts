// The Worker's own edge cache (Workers Cache, https://developers.cloudflare.com/workers/cache/).
//
// The default entrypoint (worker/handlers.ts) runs on every request and is cheap: it
// decides here whether a request may be answered from the cache, and if so passes it to
// the CachedPages entrypoint (worker/index.ts), which Cloudflare's cache sits in front
// of (wrangler.jsonc "cache" and "exports"). A hit returns the stored response without
// running Next.js, so it costs no CPU time.
//
// Only a short list of paths may be cached, all the same for everyone who may get them:
// - the landing and privacy pages, for visitors without a session cookie (a signed-in
//   visitor at "/" is sent to Today, so they always reach Next.js);
// - the share images, icons and manifest, for everyone.
// Every page Feelium renders for a signed-in user stays uncached, and a response is
// only kept if it is a 200 that sets no cookie beyond Auth.js's sign-in helpers.
//
// The cached landing page keeps the CSP nonce it was rendered with. That is safe here:
// the page shows nothing from the request, so there is nothing a reused nonce could let
// through. Each deploy starts with an empty cache (the Worker version is part of the key).

/** The landing and privacy pages: fresh for an hour, then refreshed in the background. */
const PAGE_TTL_SECONDS = 3600;

/** Share images, icons and the manifest change only with a deploy. */
const STATIC_TTL_SECONDS = 86_400;

const EDGE_STALE_SECONDS = 86_400;

/** Path -> seconds, and whether a signed-in visitor gets something else there. */
const CACHEABLE: Record<string, { ttl: number; signedOutOnly: boolean }> = {
  "/": { ttl: PAGE_TTL_SECONDS, signedOutOnly: true },
  "/privacy": { ttl: PAGE_TTL_SECONDS, signedOutOnly: true },
  "/opengraph-image": { ttl: STATIC_TTL_SECONDS, signedOutOnly: false },
  "/twitter-image": { ttl: STATIC_TTL_SECONDS, signedOutOnly: false },
  "/icon.svg": { ttl: STATIC_TTL_SECONDS, signedOutOnly: false },
  "/apple-icon.png": { ttl: STATIC_TTL_SECONDS, signedOutOnly: false },
  "/manifest.webmanifest": { ttl: STATIC_TTL_SECONDS, signedOutOnly: false },
};

const SESSION_COOKIE = /(?:^|;\s*)(?:__Secure-)?authjs\.session-token(?:\.\d+)?=/;

/** Auth.js's sign-in helpers, set on any page; /login sets them again when it is used. */
const SIGN_IN_HELPER_COOKIE = /^(?:__Host-|__Secure-)?authjs\.(?:csrf-token|callback-url)=/;

/** Whether this request may be answered from the edge cache. */
export function mayUseEdgeCache(request: Request, host: string): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const url = new URL(request.url);
  // The cache key has no host in it, so workers.dev never reads or writes it.
  if (url.hostname !== host) return false;
  const rule = CACHEABLE[url.pathname];
  if (!rule) return false;
  if (request.headers.has("authorization")) return false;
  // Client-side navigations ask for the page's RSC payload, not its HTML.
  if (request.headers.has("rsc") || request.headers.has("next-router-prefetch")) return false;
  if (rule.signedOutOnly && SESSION_COOKIE.test(request.headers.get("cookie") ?? "")) return false;
  return true;
}

/**
 * The response marked for the edge: kept for its path's time when it is a 200 with no
 * cookies of its own (Auth.js's sign-in helpers are dropped), otherwise never. The
 * Cloudflare-CDN-Cache-Control header is read by Cloudflare and never reaches browsers,
 * which keep the Cache-Control Next.js sent.
 */
export function forEdge(request: Request, response: Response): Response {
  const rule = CACHEABLE[new URL(request.url).pathname];
  const marked = new Response(response.body, response);
  const cookies = marked.headers.getSetCookie();
  const kept = cookies.filter((cookie) => !SIGN_IN_HELPER_COOKIE.test(cookie));
  const cacheable = Boolean(rule) && response.status === 200 && kept.length === 0;
  if (cacheable && cookies.length) marked.headers.delete("set-cookie");
  marked.headers.set(
    "Cloudflare-CDN-Cache-Control",
    cacheable
      ? `public, max-age=${rule.ttl}, stale-while-revalidate=${EDGE_STALE_SECONDS}`
      : "no-store",
  );
  return marked;
}

/** Scanners probing for /.env, /.git/config, /wp-admin and *.php: answered before Next.js. */
const PROBE = /^\/(?:\.(?!well-known\/)|wp-|.*\.php$)/i;

/** A plain answer for the uptime check and for scanners, or null for everything else. */
export function cheapAnswer(request: Request): Response | null {
  const { pathname } = new URL(request.url);
  if (pathname === "/healthz") {
    return new Response("ok", {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  if (PROBE.test(pathname)) {
    return new Response("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return null;
}
