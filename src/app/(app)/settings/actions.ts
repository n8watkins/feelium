"use server";

import { revalidatePath } from "next/cache";

import { signOut as authSignOut } from "@/auth";
import {
  updateProfilePreferences,
  updateProfileTimeZone,
} from "@/server/data";

/** Signs the current user out and returns them to the login screen. */
export async function signOut() {
  await authSignOut({ redirectTo: "/login" });
}

export async function updatePreferencesAction(formData: FormData) {
  const timezone = String(formData.get("timezone") ?? "").trim();
  const weekStartsOn = Number(formData.get("weekStartsOn"));
  await updateProfilePreferences({ timezone, weekStartsOn });
  revalidatePath("/settings");
}

export async function syncTimeZoneAction(timezone: string) {
  await updateProfileTimeZone(timezone);
  revalidatePath("/today");
  revalidatePath("/history");
  revalidatePath("/insights");
  revalidatePath("/settings");
}
