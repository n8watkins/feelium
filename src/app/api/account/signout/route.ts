import { signOut } from "@/auth";

/**
 * Recovery sign-out for a stale session (a JWT whose user no longer exists - see
 * StaleSessionError). The app layout redirects here when it detects the missing user.
 *
 * This lives under /api on purpose: the route guard (proxy) excludes /api, so unlike a
 * redirect straight to /login - which the guard would bounce back to /today for a
 * still-"logged in" JWT and loop forever - this handler runs, clears the session cookie
 * via signOut(), and only then redirects to /login. With the cookie gone the guard shows
 * the login screen cleanly.
 *
 * GET is intentional so a plain server-side redirect (a navigation) can reach it.
 */
export async function GET() {
  await signOut({ redirectTo: "/login" });
}
