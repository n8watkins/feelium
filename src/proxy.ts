import NextAuth from "next-auth";
import {
  NextRequest,
  NextResponse,
  type NextFetchEvent,
  type NextMiddleware,
} from "next/server";

import authConfig from "@/auth.config";
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

  if (isLoginPage) {
    // Signed-in users never see the login screen.
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/today", req.nextUrl));
    }
    return NextResponse.next({ request: { headers: req.headers } });
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("next", `${req.nextUrl.pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({ request: { headers: req.headers } });
}) as unknown as NextMiddleware;

// Next 16 statically requires a named `proxy` (or default) function export, so wrap the
// Auth.js middleware in one.
export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = buildContentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === "development",
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
  return securedResponse;
}

export const config = {
  matcher: [
    /*
     * Run on all paths except:
     * - api (Auth.js handlers live under /api/auth and must not be guarded)
     * - _next/static, _next/image, favicon, manifest, icon, and image assets
     * - sw.js (the PWA service worker must be publicly fetchable, not redirected to login)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
