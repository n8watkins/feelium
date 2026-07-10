"use server";

import { signOut as authSignOut } from "@/auth";

/** Signs the current user out and returns them to the login screen. */
export async function signOut() {
  await authSignOut({ redirectTo: "/login" });
}
