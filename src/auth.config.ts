import type { NextAuthConfig } from "next-auth";

import { authLogger } from "@/lib/log";

/**
 * Shared, dependency-light Auth.js config. Contains no database adapter, providers with
 * secrets, or Node-only modules, so it can be imported by the proxy (route guard) as
 * well as by the full `auth.ts`.
 *
 * Sessions are JWTs (no database session lookups); the Drizzle adapter in auth.ts stores
 * users and their linked GitHub accounts.
 */
const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
  // Production runs on Cloudflare Workers behind Cloudflare's proxy, so trust the forwarded
  // host. Auth.js derives the base URL from AUTH_URL and, because that is https in
  // production, automatically uses secure, host-prefixed session cookies. AUTH_SECRET must
  // be set in production.
  trustHost: true,
  // Error type and a masked message only; see src/lib/log.ts.
  logger: authLogger,
  // Providers are added in `auth.ts` (GitHub only; it needs the DB adapter).
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // The adapter's user row carries session_version; requireUserId compares it.
        token.sv = (user as { sessionVersion?: number }).sessionVersion ?? 0;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
        session.user.sessionVersion = typeof token.sv === "number" ? token.sv : 0;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
