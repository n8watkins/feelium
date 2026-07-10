import "server-only";

import { auth } from "@/auth";

/**
 * Resolves the authenticated user id from the session. Every data-access function calls
 * this and scopes its query by the returned id - a client-supplied id is never trusted.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    // Reached only if a caller bypasses the route guard; fail closed.
    throw new Error("Not authenticated");
  }
  return userId;
}
