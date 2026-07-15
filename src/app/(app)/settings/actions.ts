"use server";

import { revalidatePath } from "next/cache";

import { signOut as authSignOut } from "@/auth";
import {
  setProfileTimeZone,
  updateProfilePreferences,
  updateProfileTimeZone,
  updateReminderTimezone,
} from "@/server/data";
import { profilePreferencesSchema } from "@/lib/validation";

export type PreferencesFormState = {
  status: "idle" | "success" | "error";
  message: string;
  revision: number;
};

export type TimeZoneActionResult =
  | { ok: true }
  | { ok: false; error: string };

function revalidateDateDependentPaths() {
  revalidatePath("/settings");
  revalidatePath("/today");
  revalidatePath("/checkin/new");
  revalidatePath("/history");
  revalidatePath("/insights");
  revalidatePath("/settings/notifications");
}

/** Signs the current user out and returns them to the login screen. */
export async function signOut() {
  await authSignOut({ redirectTo: "/login" });
}

export async function updatePreferencesAction(
  previousState: PreferencesFormState,
  formData: FormData,
): Promise<PreferencesFormState> {
  const timezone = String(formData.get("timezone") ?? "").trim();
  const weekStartsOn = Number(formData.get("weekStartsOn"));
  const parsed = profilePreferencesSchema.safeParse({ timezone, weekStartsOn });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Choose a valid timezone and start of week.",
      revision: previousState.revision + 1,
    };
  }

  try {
    await updateProfilePreferences(parsed.data);
    await updateReminderTimezone(parsed.data.timezone);
  } catch {
    return {
      status: "error",
      message: "Could not save your preferences. Please try again.",
      revision: previousState.revision + 1,
    };
  }

  revalidateDateDependentPaths();
  return {
    status: "success",
    message: "Preferences saved.",
    revision: previousState.revision + 1,
  };
}

export async function syncTimeZoneAction(timezone: string) {
  const input = profilePreferencesSchema.shape.timezone.parse(timezone);
  const updated = await updateProfileTimeZone(input);
  if (!updated) return;
  await updateReminderTimezone(input);
  revalidateDateDependentPaths();
}

export async function confirmTimeZoneAction(
  timezone: string,
): Promise<TimeZoneActionResult> {
  const parsed = profilePreferencesSchema.shape.timezone.safeParse(timezone);
  if (!parsed.success) {
    return { ok: false, error: "That device timezone is not valid." };
  }
  try {
    await setProfileTimeZone(parsed.data);
    await updateReminderTimezone(parsed.data);
  } catch {
    return { ok: false, error: "Could not update your timezone. Please try again." };
  }
  revalidateDateDependentPaths();
  return { ok: true };
}
