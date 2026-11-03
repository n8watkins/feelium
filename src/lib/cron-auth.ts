import { timingSafeEqual } from "node:crypto";

/**
 * Whether a request to the reminder-send route carries the cron secret. The bearer header
 * is compared in constant time. Local development also accepts `?secret=`, never a
 * production server.
 */
export function isCronAuthorized(
  authorization: string | null,
  querySecret: string | null,
  secret: string | undefined,
  production: boolean,
): boolean {
  if (!secret) return false; // never allow when unconfigured
  if (authorization !== null && constantTimeEqual(authorization, `Bearer ${secret}`)) return true;
  return !production && querySecret !== null && constantTimeEqual(querySecret, secret);
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
