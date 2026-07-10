import NextAuth from "next-auth";
import {
  NextResponse,
  type NextFetchEvent,
  type NextMiddleware,
  type NextRequest,
} from "next/server";

import authConfig from "@/auth.config";

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
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  return NextResponse.next();
}) as unknown as NextMiddleware;

// Next 16 statically requires a named `proxy` (or default) function export, so wrap the
// Auth.js middleware in one.
export default function proxy(request: NextRequest, event: NextFetchEvent) {
  return authMiddleware(request, event);
}

export const config = {
  matcher: [
    /*
     * Run on all paths except:
     * - api (Auth.js handlers live under /api/auth and must not be guarded)
     * - _next/static, _next/image, favicon, manifest, icon, and image assets
     */
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
