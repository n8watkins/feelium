import "server-only";

import { createClient, type Config } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

type Database = ReturnType<typeof createDatabase>;

function databaseConfig(): Config {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl || tursoAuthToken) {
    if (!tursoUrl || !tursoAuthToken) {
      throw new Error(
        "TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be configured together.",
      );
    }
    return { url: tursoUrl, authToken: tursoAuthToken };
  }

  // A local SQLite fallback is convenient for development, but it would be ephemeral on
  // Vercel and could appear to accept writes before silently losing them. Fail closed there.
  if (process.env.VERCEL === "1" || process.env.VERCEL_ENV) {
    throw new Error(
      "Turso is required on Vercel. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.",
    );
  }

  return { url: process.env.DATABASE_URL ?? "file:./.data/local.db" };
}

function createDatabase() {
  const client = createClient(databaseConfig());
  return drizzle({ client, schema });
}

let database: Database | null = null;

/** Lazily creates the database client on first use, never while a module is imported. */
export function getDb(): Database {
  database ??= createDatabase();
  return database;
}

/**
 * Backward-compatible lazy database handle. Property access resolves the singleton only when
 * a query actually runs, so Auth.js and Server Component imports stay build-safe.
 */
export const db = new Proxy({} as Database, {
  get(_target, property) {
    const target = getDb();
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
