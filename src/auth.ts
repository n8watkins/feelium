import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import type { Adapter } from "next-auth/adapters";
import GitHub from "next-auth/providers/github";

import authConfig from "@/auth.config";
import { getDb } from "@/db";
import { withoutOAuthTokens } from "@/lib/oauth-account";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

// GitHub OAuth is the only way to sign in (owner decision, 2026-11-03: email magic-link and
// email/password sign-in were removed, along with Resend; see docs/DEVIATIONS.md ADR-002).

/**
 * The Drizzle adapter, except that GitHub's OAuth tokens are never stored: Feelium never
 * calls the GitHub API, so keeping them would only be a liability.
 */
function adapter(): Adapter {
  const base = DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  });
  return {
    ...base,
    linkAccount: (account) => base.linkAccount!(withoutOAuthTokens(account)),
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  ...authConfig,
  adapter: adapter(),
  providers: [
    // Social sign-in: GitHub OAuth. Auth.js auto-reads AUTH_GITHUB_ID / AUTH_GITHUB_SECRET.
    // The Drizzle adapter creates and links the user/account rows.
    GitHub,
  ],
}));
