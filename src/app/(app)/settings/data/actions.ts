"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { deleteAccount, deleteAllTrackingData } from "@/server/data";

export type DeleteResult = { ok: boolean; error?: string };

/**
 * Deletes all of the current user's tracking data and returns them to a now-empty Today
 * screen (PRD 19). The account and profile survive, so they stay signed in. On failure we
 * return an error the dialog surfaces; on success we redirect (which never returns).
 */
export async function deleteAllTrackingDataAction(
  confirmation: string,
): Promise<DeleteResult> {
  if (confirmation !== "DELETE") {
    return { ok: false, error: "Type DELETE to confirm this operation." };
  }
  try {
    await deleteAllTrackingData();
  } catch (error) {
    console.error("deleteAllTrackingData failed", error);
    return {
      ok: false,
      error: "We couldn't delete your data. Please try again.",
    };
  }

  revalidatePath("/today");
  revalidatePath("/history");
  revalidatePath("/insights");
  revalidatePath("/settings");
  redirect("/today");
}

/**
 * Permanently deletes the current user's account and every record scoped to it (PRD 19/21),
 * then signs them out to the login screen. signOut() clears the session cookie and
 * redirects; if any JWT survives, the stale-session guard handles it on the next request.
 */
export async function deleteAccountAction(
  confirmation: string,
): Promise<DeleteResult> {
  const session = await auth();
  const expected = session?.user?.email ?? "delete my account";
  if (confirmation !== expected) {
    return { ok: false, error: "The account confirmation did not match." };
  }
  try {
    await deleteAccount();
  } catch (error) {
    console.error("deleteAccount failed", error);
    return {
      ok: false,
      error: "We couldn't delete your account. Please try again.",
    };
  }

  await signOut({ redirectTo: "/login" });
  // Unreachable: signOut() throws a redirect. Present only to satisfy the return type.
  return { ok: true };
}
