import { NextResponse, type NextRequest } from "next/server";

import { signOut } from "@/auth";
import { isSameOriginPost } from "@/lib/same-origin";

/**
 * Sign-out endpoint. It lives under /api on purpose: the route guard (proxy) excludes
 * /api, so nothing else touches the session cookie on these requests.
 *
 * On Cloudflare Workers, a sign-out run as a server action on a page cannot clear the
 * cookie. The proxy's Auth.js wrapper re-issues the session cookie on every page request,
 * and OpenNext emits that Set-Cookie after the action's clearing one, so the browser keeps
 * the session and is sent straight back to /today. Signing out here avoids the race.
 *
 * POST is the Log out button in Settings (a plain form, so it also works without
 * JavaScript). GET is the recovery path for a stale session (a JWT whose user no longer
 * exists - see StaleSessionError): the app layout redirects here, which clears the cookie
 * and lands on /login instead of looping through the guard.
 */
export async function GET() {
  await signOut({ redirectTo: "/login" });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginPost(request)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  // redirect: false so the response can be a 303: a 307 would replay the POST on /login.
  const { redirect } = await signOut({ redirect: false, redirectTo: "/login" });
  return NextResponse.redirect(new URL(redirect ?? "/login", request.url), 303);
}
