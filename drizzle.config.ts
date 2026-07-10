import { defineConfig } from "drizzle-kit";

// Local-only libSQL: a SQLite file under ./.data. No Turso cloud, no auth token.
// drizzle-kit does not load .env.local, so the hardcoded local fallback is used for
// generate/migrate; the app itself reads DATABASE_URL from the environment.
const url = process.env.DATABASE_URL ?? "file:./.data/local.db";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url },
});
