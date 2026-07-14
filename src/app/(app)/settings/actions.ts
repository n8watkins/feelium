"use server";

import { revalidatePath } from "next/cache";

import { signOut as authSignOut } from "@/auth";
import {
  updateProfilePreferences,
  updateProfileTimeZone,
} from "@/server/data";
import { profilePreferencesSchema } from "@/lib/validation";

/** Signs the current user out and returns them to the login screen. */
export async function signOut() {
  await authSignOut({ redirectTo: "/login" });
}

export async function updatePreferencesAction(formData: FormData) {
  const timezone = String(formData.get("timezone") ?? "").trim();
  const weekStartsOn = Number(formData.get("weekStartsOn"));
  const input = profilePreferencesSchema.parse({ timezone, weekStartsOn });
  await updateProfilePreferences(input);
  revalidatePath("/settings");
}

export async function syncTimeZoneAction(timezone: string) {
  const input = profilePreferencesSchema.shape.timezone.parse(timezone);
  await updateProfileTimeZone(input);
  revalidatePath("/today");
  revalidatePath("/history");
  revalidatePath("/insights");
  revalidatePath("/settings");
}
