import { defineConfig } from "drizzle-kit";

// Env-driven migrations. The same migration files in ./drizzle apply to both targets.
//
//   Local dev (default):
//     npm run db:migrate            # uses DATABASE_URL (file: url under ./.data)
//
//   Cloud Turso (production):
//     TURSO_DATABASE_URL=libsql://<db>.turso.io TURSO_AUTH_TOKEN=<token> npm run db:migrate
//
// drizzle-kit does NOT auto-load .env.local, so pass the vars on the command line (or via
// the deploy environment). When both Turso vars are present we use the `turso` dialect;
// otherwise the local `sqlite` file dialect, so the local flow is byte-for-byte unchanged.
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

const config =
  tursoUrl && tursoAuthToken
    ? defineConfig({
        schema: "./src/db/schema/index.ts",
        out: "./drizzle",
        dialect: "turso",
        dbCredentials: { url: tursoUrl, authToken: tursoAuthToken },
      })
    : defineConfig({
        schema: "./src/db/schema/index.ts",
        out: "./drizzle",
        dialect: "sqlite",
        dbCredentials: {
          url: process.env.DATABASE_URL ?? "file:./.data/local.db",
        },
      });

export default config;
