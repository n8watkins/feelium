import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

import authConfig from "@/auth.config";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

// ---------------------------------------------------------------------------
// TEMPORARILY DISABLED: password + magic-link sign-in (GitHub is the only way in "atm").
//
// Why: production only has the GitHub OAuth callback wired up, and Resend on the current
// plan can only email the account owner, so the magic-link flow is broken for everyone
// else. Until the Resend sender domain / plan is sorted, GitHub OAuth is the sole provider.
//
// To RE-ENABLE: uncomment the imports and the emailProvider definition below, add
// `emailProvider` and the `Credentials({...})` entry back into the `providers` array, and
// restore the email/password + magic-link UI in src/app/login/page.tsx. The server actions
// (sendMagicLink / signInWithPassword / signUpWithPassword) are left intact in
// src/app/login/actions.ts, so nothing needs to be rewritten - just re-wire the providers.
// ---------------------------------------------------------------------------
// import bcrypt from "bcryptjs";
// import { eq } from "drizzle-orm";
// import Credentials from "next-auth/providers/credentials";
// import Nodemailer from "next-auth/providers/nodemailer";
// import Resend from "next-auth/providers/resend";

// const isProduction = process.env.NODE_ENV === "production";

// Sender for magic-link emails. Override with AUTH_EMAIL_FROM in production; the default is
// Resend's shared testing sender, which only delivers to the Resend account owner - real
// production sending needs a verified sender domain configured in Resend and set here.
// const EMAIL_FROM = process.env.AUTH_EMAIL_FROM ?? "feelium <onboarding@resend.dev>";

/**
 * The magic-link email provider, selected by environment but exposed under a single stable
 * provider id ("email") so the login action calls `signIn("email", ...)` in both:
 *   - Production: Resend sends the real email (reads AUTH_RESEND_KEY).
 *   - Development: Nodemailer with sendVerificationRequest overridden to print the sign-in
 *     URL to the server console - no SMTP or email account needed locally.
 */
// const emailProvider = isProduction
//   ? Resend({ id: "email", apiKey: process.env.AUTH_RESEND_KEY, from: EMAIL_FROM })
//   : Nodemailer({
//       id: "email",
//       server: { host: "localhost", port: 587, auth: { user: "dev", pass: "dev" } },
//       from: EMAIL_FROM,
//       async sendVerificationRequest({ identifier, url }) {
//         console.log(
//           "\n============================================================\n" +
//             `  Magic sign-in link for ${identifier}:\n  ${url}\n` +
//             "============================================================\n",
//         );
//       },
//     });

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    // Social sign-in: GitHub OAuth. Auth.js auto-reads AUTH_GITHUB_ID / AUTH_GITHUB_SECRET.
    // The Drizzle adapter creates and links the user/account rows.
    GitHub,
    // --- DISABLED (re-enable per the note at the top of this file) ---
    // DEFAULT sign-in: email magic link (see emailProvider above).
    // emailProvider,
    // Optional email + password (PRD 11.1). Passwords are bcrypt-hashed in the DB.
    // Credentials({
    //   credentials: {
    //     email: { label: "Email", type: "email" },
    //     password: { label: "Password", type: "password" },
    //   },
    //   async authorize(credentials) {
    //     const email =
    //       typeof credentials?.email === "string" ? credentials.email : "";
    //     const password =
    //       typeof credentials?.password === "string" ? credentials.password : "";
    //     if (!email || !password) return null;
    //
    //     const [user] = await db
    //       .select()
    //       .from(users)
    //       .where(eq(users.email, email))
    //       .limit(1);
    //
    //     if (!user?.passwordHash) return null;
    //
    //     const valid = await bcrypt.compare(password, user.passwordHash);
    //     if (!valid) return null;
    //
    //     return {
    //       id: user.id,
    //       email: user.email,
    //       name: user.name,
    //       image: user.image,
    //     };
    //   },
    // }),
  ],
});
