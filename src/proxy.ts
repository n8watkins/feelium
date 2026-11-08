import NextAuth from "next-auth";
import {
  NextRequest,
  NextResponse,
  type NextFetchEvent,
  type NextMiddleware,
} from "next/server";

import authConfig from "@/auth.config";
import { isAppPath } from "@/lib/app-paths";
import { sentryOrigin } from "@/lib/error-reporting";
import { buildContentSecurityPolicy } from "@/lib/security-headers";

// Next.js 16 proxy (renamed middleware). Uses the dependency-light auth config so this
// path never bundles the DB adapter or Node-only modules. Auth.js decodes the JWT into
// `req.auth`; this handler enforces the route guard.
const { auth } = NextAuth(authConfig);

// `auth(handler)` returns an overloaded function; narrow it to the middleware signature,
// which it satisfies at runtime.
const authMiddleware = auth((req) => {
  const isLoggedIn = Boolean(req.auth?.user);
  const isLoginPage = req.nextUrl.pathname === "/login";
  // Public pages anyone can read before signing in. The landing page at "/" sends
  // signed-in visitors to Today itself.
  if (req.nextUrl.pathname === "/privacy" || req.nextUrl.pathname === "/") {
    return NextResponse.next({ request: { headers: req.headers } });
  }

  if (isLoginPage) {
    // Signed-in users never see the login screen.
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/today", req.nextUrl));
    }
    return NextResponse.next({ request: { headers: req.headers } });
  }

  // Only the app's own screens need a session. Anything else falls through to the
  // router, so an unknown path gets the styled 404 with a real 404 status instead of a
  // detour through sign-in.
  if (!isLoggedIn && isAppPath(req.nextUrl.pathname)) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("next", `${req.nextUrl.pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({ request: { headers: req.headers } });
}) as unknown as NextMiddleware;

// The Auth.js wrapper re-issues (rolls) the session cookie on every request it sees. Only
// let that through on a real page navigation. Prefetches, RSC fetches and server-action
// POSTs run alongside other requests, and a refreshed cookie on one of them can land after
// a sign-out has cleared it, signing the user straight back in. On Workers that also beat
// the clearing cookie of a sign-out server action, because OpenNext emits proxy cookies
// after the page's own.
function isPageNavigation(request: NextRequest): boolean {
  return (
    request.method === "GET" &&
    request.headers.get("sec-fetch-mode") === "navigate" &&
    !request.headers.has("rsc") &&
    !request.headers.has("next-router-prefetch") &&
    !request.headers.has("next-action")
  );
}

const SESSION_COOKIE = /^(__Secure-)?authjs\.session-token(\.\d+)?=/;

function dropSessionRefresh(response: Response) {
  const cookies = response.headers.getSetCookie();
  if (!cookies.some((cookie) => SESSION_COOKIE.test(cookie))) return;
  response.headers.delete("set-cookie");
  for (const cookie of cookies) {
    if (!SESSION_COOKIE.test(cookie)) response.headers.append("set-cookie", cookie);
  }
}

// Next 16 statically requires a named `proxy` (or default) function export, so wrap the
// Auth.js middleware in one.
export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = buildContentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === "development",
    {
      webAnalytics: Boolean(process.env.CF_WEB_ANALYTICS_TOKEN),
      sentryOrigin: sentryOrigin(process.env.SENTRY_DSN),
    },
  );
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  const requestWithSecurityHeaders = new NextRequest(request, {
    headers: requestHeaders,
  });
  const response = await authMiddleware(requestWithSecurityHeaders, event);
  const securedResponse =
    response ??
    NextResponse.next({
      request: { headers: requestHeaders },
    });
  securedResponse.headers.set("Content-Security-Policy", contentSecurityPolicy);
  if (!isPageNavigation(request)) dropSessionRefresh(securedResponse);
  return securedResponse;
}

export const config = {
  matcher: [
    /*
     * Run on all paths except:
     * - api (Auth.js handlers live under /api/auth and must not be guarded)
     * - _next/static, _next/image, favicon, manifest, icon, and image assets
     * - sw.js (the PWA service worker must be publicly fetchable, not redirected to login)
     * - opengraph-image, twitter-image and og/ (link-preview crawlers have no session)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon.svg|opengraph-image|twitter-image|og/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
