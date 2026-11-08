// The signed-in app: every screen under these needs a session (src/proxy.ts).
const APP_PATHS = ["/today", "/history", "/insights", "/settings", "/checkin", "/onboarding"];

/** True for a path inside the signed-in app, false for public and unknown paths. */
export function isAppPath(pathname: string): boolean {
  return APP_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
