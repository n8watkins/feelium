import "server-only";

import webpush from "web-push";

/**
 * Web Push transport (PRD 17). Configures VAPID once per server process and sends
 * notifications. The public key is also exposed to the browser via
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY; the private key (VAPID_PRIVATE_KEY) stays server-side.
 *
 * Generate keys locally with `npx web-push generate-vapid-keys` and put them in
 * .env.local (see .env.local.example). Everything degrades gracefully when the keys are
 * absent so the app still runs without push configured.
 */

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
// Contact URI the push service can reach if there's a problem with our requests.
const subject = process.env.VAPID_SUBJECT || "mailto:notifications@example.com";
const PUSH_REQUEST_TIMEOUT_MS = 1_000;

let configured = false;

/** Whether the server has the VAPID key pair needed to send push messages. */
export function isPushConfigured(): boolean {
  return Boolean(publicKey && privateKey);
}

function ensureConfigured(): void {
  if (configured) return;
  if (!publicKey || !privateKey) {
    throw new Error(
      "Web Push is not configured: set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.",
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  /** Path the notification deep-links to when tapped (PRD 17). */
  url?: string;
};

export type SendResult =
  | { ok: true }
  | { ok: false; statusCode?: number; gone: boolean; error: string };

/**
 * Sends one push message. Never throws: returns a result so callers can prune dead
 * subscriptions. `gone` is true for 404/410, which mean the subscription is expired and
 * should be deleted.
 */
export async function sendPush(
  subscription: webpush.PushSubscription,
  payload: PushPayload,
): Promise<SendResult> {
  ensureConfigured();
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      timeout: PUSH_REQUEST_TIMEOUT_MS,
    });
    return { ok: true };
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    const gone = statusCode === 404 || statusCode === 410;
    return { ok: false, statusCode, gone, error: (error as Error).message };
  }
}
