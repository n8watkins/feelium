import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/auth";
import { db } from "@/db";
import { getSessionVersionForUser } from "./session-operations";

// One database read per request, however many data functions run.
const currentSessionVersion = cache((userId: string) => getSessionVersionForUser(db, userId));

/**
 * Resolves the authenticated user id from the session. Every data-access function calls
 * this and scopes its query by the returned id - a client-supplied id is never trusted.
 *
 * A session minted before the user chose "Sign out on every device" carries an older
 * session version: the request is sent through the cookie-clearing sign-out instead.
 * (A redirect, not an error, because pages render alongside the layout and would fail
 * first.) A missing user is left to the callers, as before.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    // Reached only if a caller bypasses the route guard; fail closed.
    throw new Error("Not authenticated");
  }
  const version = await currentSessionVersion(userId);
  if (version !== null && version !== (session.user.sessionVersion ?? 0)) {
    redirect("/api/account/signout");
  }
  return userId;
}
