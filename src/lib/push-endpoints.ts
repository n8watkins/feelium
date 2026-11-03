/**
 * Push subscriptions must point at a browser vendor's push service. The server POSTs to
 * the endpoint for every test send and reminder, so an arbitrary URL would let any account
 * use Feelium to send requests to any host.
 */
const EXACT_HOSTS = new Set([
  "fcm.googleapis.com", // Chrome, Edge (Chromium), Brave, Opera, Samsung Internet
  "android.googleapis.com", // older Chrome subscriptions
  "updates.push.services.mozilla.com", // Firefox
  "web.push.apple.com", // Safari on macOS and iOS
]);
const HOST_SUFFIXES = [".push.apple.com", ".notify.windows.com"]; // Apple, Windows (WNS)

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  // HTTPS on the default port, with nothing before the host (no user info).
  if (url.protocol !== "https:" || url.port) return false;
  if (!url.href.startsWith(`https://${url.host}/`)) return false;
  const host = url.hostname.toLowerCase();
  return EXACT_HOSTS.has(host) || HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/** How many browsers one account can register; the oldest is dropped past this. */
export const MAX_PUSH_SUBSCRIPTIONS_PER_USER = 10;

/** How often one account can send a test reminder. */
export const TEST_PUSH_INTERVAL_MS = 60_000;
