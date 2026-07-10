"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { safeRedirectPath } from "@/lib/safe-redirect";

const MIN_PASSWORD_LENGTH = 8;

function readEmail(formData: FormData): string {
  return String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
}

/**
 * DEFAULT sign-in: email magic link. In local dev the link is printed to the server
 * console by the Nodemailer provider's sendVerificationRequest override.
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

/**
 * Social sign-in: GitHub OAuth. `signIn` redirects to GitHub's authorize URL (client_id
 * from AUTH_GITHUB_ID, callback /api/auth/callback/github); the returning round-trip is
 * handled by the Drizzle adapter, which creates and links the user/account.
 */
export async function signInWithGitHub(formData: FormData) {
  const next = safeRedirectPath(formData.get("next") as string | null);
  await signIn("github", { redirectTo: next });
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
