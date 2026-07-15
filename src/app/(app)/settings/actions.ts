"use server";

import { revalidatePath } from "next/cache";

import { signOut as authSignOut } from "@/auth";
import {
  updateProfilePreferences,
  updateProfileTimeZone,
} from "@/server/data";
import { profilePreferencesSchema } from "@/lib/validation";

export type PreferencesFormState = {
  status: "idle" | "success" | "error";
  message: string;
  revision: number;
};

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
  } catch {
    return {
      status: "error",
      message: "Could not save your preferences. Please try again.",
      revision: previousState.revision + 1,
    };
  }

  revalidatePath("/settings");
  revalidatePath("/today");
  revalidatePath("/checkin/new");
  revalidatePath("/history");
  revalidatePath("/insights");
  return {
    status: "success",
    message: "Preferences saved.",
    revision: previousState.revision + 1,
  };
}

export async function syncTimeZoneAction(timezone: string) {
  const input = profilePreferencesSchema.shape.timezone.parse(timezone);
  await updateProfileTimeZone(input);
  revalidatePath("/today");
  revalidatePath("/history");
  revalidatePath("/insights");
  revalidatePath("/settings");
}
