import "server-only";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { safeRedirectPath } from "@/lib/safe-redirect";

/**
 * DISABLED: email magic-link and email/password sign-in (GitHub is the only way in; see
 * the note at the top of src/auth.ts and docs/DEVIATIONS.md ADR-002).
 *
 * This is deliberately NOT a "use server" module: as server actions these were reachable
 * by a POST even with the UI and providers off, and sign-up created accounts. Before
 * re-enabling, wrap each in a server action in src/app/login/actions.ts, and change
 * sign-up to create the user only after the email address is verified (otherwise anyone
 * can claim an address and block that person's GitHub sign-in with OAuthAccountNotLinked),
 * and rate-limit it.
 */

const MIN_PASSWORD_LENGTH = 8;

function readEmail(formData: FormData): string {
  return String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
}

/**
 * DEFAULT sign-in: email magic link. In local dev the link is printed to the server
 * console by the development email provider's sendVerificationRequest implementation.
 */
export async function sendMagicLink(formData: FormData) {
  const email = readEmail(formData);
  const next = safeRedirectPath(formData.get("next") as string | null);
  if (!email) {
    redirect("/login?error=Enter+your+email+address");
  }

  try {
    await signIn("email", { email, redirect: false, redirectTo: next });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=Could+not+send+sign-in+link");
    }
    throw error;
  }
  redirect("/login?sent=1");
}

/** Optional email + password sign-in. */
export async function signInWithPassword(formData: FormData) {
  const email = readEmail(formData);
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectPath(formData.get("next") as string | null);

  try {
    await signIn("credentials", { email, password, redirectTo: next });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=Invalid+email+or+password");
    }
    throw error; // re-throw the NEXT_REDIRECT thrown on success
  }
}

/** Optional email + password sign-up. Creates the user with a hashed password. */
export async function signUpWithPassword(formData: FormData) {
  const email = readEmail(formData);
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectPath(formData.get("next") as string | null);

  if (!email) {
    redirect("/login?error=Enter+your+email+address");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    redirect("/login?error=Password+must+be+at+least+8+characters");
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    redirect("/login?error=An+account+with+that+email+already+exists");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({ email, passwordHash });

  try {
    await signIn("credentials", { email, password, redirectTo: next });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=Could+not+sign+in+after+sign-up");
    }
    throw error;
  }
}
