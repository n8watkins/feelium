"use server";

import type { PushSubscription as WebPushSubscription } from "web-push";

import { revalidatePath } from "next/cache";

import {
  createReminderSettings,
  deleteReminderSettings,
  deleteMyPushSubscription,
  claimMyTestPush,
  getMyPushSubscription,
  savePushSubscription,
  updateReminderSettings,
  type ReminderSchedule,
  type WebPushSubscriptionJSON,
} from "@/server/data";
import { isPushConfigured, sendPush } from "@/server/push/webpush";
import {
  deviceNameSchema,
  pushEndpointSchema,
  pushSubscriptionSchema,
  recordIdSchema,
  reminderSettingsSchema,
} from "@/lib/validation";

export type ActionResult = { ok: true } | { ok: false; error: string };

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
    return {
      ok: false,
      error: "Could not save your subscription. Please try again.",
    };
  }
  revalidatePath("/settings/notifications");
  return { ok: true };
}

/** Removes a push subscription (e.g. the user turned notifications off on this device). */
export async function unsubscribeFromPushAction(
  endpoint: string,
): Promise<ActionResult> {
  if (!endpoint) return { ok: false, error: "Missing subscription." };
  try {
    await deleteMyPushSubscription(endpoint);
  } catch {
    return {
      ok: false,
      error: "Could not remove your subscription. Please try again.",
    };
  }
  revalidatePath("/settings/notifications");
  return { ok: true };
}

type ReminderActionResult =
  { ok: true; reminder?: ReminderSchedule } | { ok: false; error: string };

function duplicateReminderError(error: unknown): boolean {
  let current: unknown = error;
  while (current instanceof Error) {
    if (
      current.message.includes("reminder_setting_unique_time_per_user") ||
      current.message.includes(
        "reminder_setting.user_id, reminder_setting.reminder_time",
      )
    ) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

function parseReminderInput(input: {
  isEnabled: boolean;
  reminderTime: string;
  timezone: string;
}) {
  const parsed = reminderSettingsSchema.safeParse(input);
  if (!parsed.success || !parsed.data.reminderTime) return null;
  return {
    isEnabled: parsed.data.isEnabled,
    reminderTime: parsed.data.reminderTime,
    timezone: parsed.data.timezone,
  };
}

export async function createReminderAction(input: {
  reminderTime: string;
  timezone: string;
}): Promise<ReminderActionResult> {
  const parsed = parseReminderInput({ ...input, isEnabled: true });
  if (!parsed) {
    return { ok: false, error: "Choose a valid reminder time." };
  }
  try {
    const reminder = await createReminderSettings(parsed);
    revalidatePath("/settings/notifications");
    return { ok: true, reminder };
  } catch (error) {
    if (duplicateReminderError(error)) {
      return { ok: false, error: "A reminder at that time already exists." };
    }
    return {
      ok: false,
      error: "Could not save your reminder. Please try again.",
    };
  }
}

export async function updateReminderAction(
  reminderId: string,
  input: { isEnabled: boolean; reminderTime: string; timezone: string },
): Promise<ReminderActionResult> {
  const id = recordIdSchema.safeParse(reminderId);
  const parsed = parseReminderInput(input);
  if (!id.success || !parsed) {
    return { ok: false, error: "Choose a valid reminder time." };
  }
  try {
    const updated = await updateReminderSettings(id.data, parsed);
    if (!updated) return { ok: false, error: "Reminder not found." };
    revalidatePath("/settings/notifications");
    return { ok: true };
  } catch (error) {
    if (duplicateReminderError(error)) {
      return { ok: false, error: "A reminder at that time already exists." };
    }
    return {
      ok: false,
      error: "Could not save your reminder. Please try again.",
    };
  }
}

export async function deleteReminderAction(
  reminderId: string,
): Promise<ActionResult> {
  const id = recordIdSchema.safeParse(reminderId);
  if (!id.success) return { ok: false, error: "Reminder not found." };
  try {
    const deleted = await deleteReminderSettings(id.data);
    if (!deleted) return { ok: false, error: "Reminder not found." };
    revalidatePath("/settings/notifications");
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Could not delete your reminder. Please try again.",
    };
  }
}

export type TestSendResult =
  { ok: true } | { ok: false; error: string };

/**
 * Sends one test reminder to this browser only (its own subscription endpoint), at most
 * once a minute per account. Prunes the subscription if the push service reports it gone.
 */
export async function sendTestNotificationAction(
  endpoint: string,
): Promise<TestSendResult> {
  if (!isPushConfigured()) {
    return { ok: false, error: "Push is not configured on the server." };
  }
  const parsed = pushEndpointSchema.safeParse(endpoint);
  const subscription = parsed.success ? await getMyPushSubscription(parsed.data) : null;
  if (!subscription) {
    return { ok: false, error: "Set up this device first, then send a test." };
  }
  if (!(await claimMyTestPush())) {
    return { ok: false, error: "You just sent a test. Try again in a minute." };
  }
  const result = await sendPush(
    subscription.subscriptionData as unknown as WebPushSubscription,
    {
      title: REMINDER_TITLE,
      body: "This is a test reminder. Tap to open your check-in.",
      url: REMINDER_URL,
    },
  );
  if (result.ok) return { ok: true };
  if (result.gone) {
    await deleteMyPushSubscription(subscription.endpoint);
    return { ok: false, error: "This device's subscription expired. Set it up again." };
  }
  return { ok: false, error: "Could not deliver the test. Try again in a minute." };
}
