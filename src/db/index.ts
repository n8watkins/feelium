import "server-only";

import { createClient, type Config } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

// One env-driven libSQL client (module singleton: evaluated once per server process, never
// per request). It works both locally and in the Vercel Node serverless runtime:
//   - Production (cloud Turso): set TURSO_DATABASE_URL (libsql://...) and TURSO_AUTH_TOKEN.
//   - Development (local file): DATABASE_URL as a `file:` url (default ./.data/local.db),
//     resolved relative to the process cwd (repo root). No auth token.
// The Turso cloud URL takes precedence when present so a deployed app never accidentally
// falls back to an ephemeral local file.
const url =
  process.env.TURSO_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "file:./.data/local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

const config: Config = authToken ? { url, authToken } : { url };
const client = createClient(config);

export const db = drizzle({ client, schema });
