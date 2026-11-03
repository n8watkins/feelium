import type { NextRequest } from "next/server";

/**
 * True when the browser says a form POST came from this site (CSRF protection for the
 * route handlers under /api, which Next's server-action origin check does not cover).
 */
export function isSameOriginPost(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (!origin) return fetchSite === "same-origin";
  const allowed = new Set([request.nextUrl.origin]);
  if (process.env.AUTH_URL) allowed.add(new URL(process.env.AUTH_URL).origin);
  return allowed.has(origin);
}
