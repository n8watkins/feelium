"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const DEFAULT_NEXT = "/today";

async function getOrigin() {
  const headerList = await headers();
  // `origin` is present on Server Action requests; fall back to the local dev origin.
  return headerList.get("origin") ?? "http://localhost:3000";
}

/**
 * Default sign-in: email magic link (email OTP). Sends a link that opens the
 * server-side /auth/confirm route (token_hash + verifyOtp flow).
 */
export async function signInWithMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect("/login?error=Enter+your+email+address");
  }

  const supabase = await createClient();
  const origin = await getOrigin();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=${DEFAULT_NEXT}` },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/login?sent=1");
}

/** Optional email + password sign-in. */
export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect(DEFAULT_NEXT);
}

/** Optional email + password sign-up. Locally, email confirmation is disabled so the
 *  session is created immediately. */
export async function signUpWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=${DEFAULT_NEXT}` },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  // With email confirmations off (local), a session exists right away.
  if (data.session) {
    redirect(DEFAULT_NEXT);
  }
  redirect("/login?sent=1");
}
