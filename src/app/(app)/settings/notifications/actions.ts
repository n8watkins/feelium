"use server";

import type { PushSubscription as WebPushSubscription } from "web-push";

import { revalidatePath } from "next/cache";

import {
  deleteMyPushSubscription,
  listMyPushSubscriptions,
  savePushSubscription,
  upsertReminderSettings,
  type ReminderSettings,
  type WebPushSubscriptionJSON,
} from "@/server/data";
import { isPushConfigured, sendPush } from "@/server/push/webpush";
import {
  deviceNameSchema,
  pushSubscriptionSchema,
  reminderSettingsSchema,
} from "@/lib/validation";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Matches a 24h "HH:MM" time-of-day. */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The gentle reminder copy (PRD 17: no guilt/shame; tapping opens the check-in). */
const REMINDER_URL = "/checkin/new";
const REMINDER_TITLE = "Ready for a quick check-in?";

/** Stores the browser's push subscription for the current user + device. */
export async function subscribeToPushAction(
  subscription: WebPushSubscriptionJSON,
  deviceName?: string,
): Promise<ActionResult> {
  const parsed = pushSubscriptionSchema.safeParse(subscription);
  const parsedDeviceName = deviceNameSchema.safeParse(deviceName);
  if (!parsed.success || !parsedDeviceName.success) {
    return { ok: false, error: "That push subscription looks invalid." };
  }
  try {
    await savePushSubscription(parsed.data, parsedDeviceName.data ?? null);
  } catch {
    return { ok: false, error: "Could not save your subscription. Please try again." };
  }
  revalidatePath("/settings/notifications");
  return { ok: true };
}

/** Removes a push subscription (e.g. the user turned notifications off on this device). */
export async function unsubscribeFromPushAction(endpoint: string): Promise<ActionResult> {
  if (!endpoint) return { ok: false, error: "Missing subscription." };
  try {
    await deleteMyPushSubscription(endpoint);
  } catch {
    return { ok: false, error: "Could not remove your subscription. Please try again." };
  }
  revalidatePath("/settings/notifications");
  return { ok: true };
}

/** Saves the single daily reminder (enabled, time, timezone). PRD 17. */
export async function saveReminderSettingsAction(
  input: ReminderSettings,
): Promise<ActionResult> {
  const normalized = {
    ...input,
    reminderTime: input.reminderTime && TIME_RE.test(input.reminderTime) ? input.reminderTime : null,
  };
  const parsed = reminderSettingsSchema.safeParse(normalized);
  if (!parsed.success || (parsed.data.isEnabled && !parsed.data.reminderTime)) {
    return { ok: false, error: "Choose a valid reminder time." };
  }

  try {
    await upsertReminderSettings(parsed.data);
  } catch {
    return { ok: false, error: "Could not save your reminder. Please try again." };
  }
  revalidatePath("/settings/notifications");
  return { ok: true };
}

export type TestSendResult = { ok: true; sent: number } | { ok: false; error: string };

/**
 * Sends a test reminder to every device the current user has subscribed. Prunes any
 * subscriptions the push service reports as gone (404/410).
 */
export async function sendTestNotificationAction(): Promise<TestSendResult> {
  if (!isPushConfigured()) {
    return { ok: false, error: "Push is not configured on the server." };
  }
  const subs = await listMyPushSubscriptions();
  if (subs.length === 0) {
    return { ok: false, error: "No devices are subscribed on this account yet." };
  }

  let sent = 0;
  for (const sub of subs) {
    const result = await sendPush(sub.subscriptionData as unknown as WebPushSubscription, {
      title: REMINDER_TITLE,
      body: "This is a test reminder. Tap to open your check-in.",
      url: REMINDER_URL,
    });
    if (result.ok) {
      sent += 1;
    } else if (result.gone) {
      await deleteMyPushSubscription(sub.endpoint);
    }
  }

  if (sent === 0) {
    return { ok: false, error: "Could not deliver to any device. Try turning reminders off and on." };
  }
  return { ok: true, sent };
}
