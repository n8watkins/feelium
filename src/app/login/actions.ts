"use server";

import { signIn } from "@/auth";
import { safeRedirectPath } from "@/lib/safe-redirect";

// Only GitHub sign-in is a server action. Every export of a "use server" module can be
// called with a POST whether or not a page renders it, so the disabled email and password
// flows live in src/server/auth/email-sign-in.ts, which is not one.

/**
 * Social sign-in: GitHub OAuth. `signIn` redirects to GitHub's authorize URL (client_id
 * from AUTH_GITHUB_ID, callback /api/auth/callback/github); the returning round-trip is
 * handled by the Drizzle adapter, which creates and links the user/account.
 */
export async function signInWithGitHub(formData: FormData) {
  const next = safeRedirectPath(formData.get("next") as string | null);
  await signIn("github", { redirectTo: next });
}
