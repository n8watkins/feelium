import { DrizzleAdapter } from "@auth/drizzle-adapter";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Nodemailer from "next-auth/providers/nodemailer";

import authConfig from "@/auth.config";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    // DEFAULT sign-in: email magic link. For local dev there is no SMTP - the sign-in
    // URL is printed to the server console (watch the `npm run dev` terminal). The dummy
    // `server`/`from` are never used because sendVerificationRequest is overridden.
    Nodemailer({
      server: { host: "localhost", port: 587, auth: { user: "dev", pass: "dev" } },
      from: "no-reply@localhost",
      async sendVerificationRequest({ identifier, url }) {
        console.log(
          "\n============================================================\n" +
            `  Magic sign-in link for ${identifier}:\n  ${url}\n` +
            "============================================================\n",
        );
      },
    }),
    // Optional email + password (PRD 11.1). Passwords are bcrypt-hashed in the DB.
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string" ? credentials.email : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
});
