import type { NextAuthConfig } from "next-auth";

/**
 * Shared, dependency-light Auth.js config. Contains no database adapter, providers with
 * secrets, or Node-only modules, so it can be imported by the proxy (route guard) as
 * well as by the full `auth.ts`.
 *
 * JWT session strategy is required because the Credentials provider only works with JWT
 * sessions; the Email/magic-link provider honors JWT too and uses the adapter solely for
 * verification-token storage.
 */
const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
    verifyRequest: "/login?sent=1",
  },
  session: { strategy: "jwt" },
  // Production runs behind Vercel's proxy, so trust the forwarded host. Auth.js derives
  // the base URL from AUTH_URL and, because that is https in production, automatically
  // uses secure, host-prefixed session cookies. AUTH_SECRET must be set in production.
  trustHost: true,
  // Providers are added in `auth.ts` (they pull in the DB adapter and bcrypt).
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
