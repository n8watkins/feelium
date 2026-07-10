import "server-only";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

// Module singleton: evaluated once per server process. Never create a client per request.
// The `file:` URL is resolved relative to the process cwd (repo root), so the database
// lands at <repo-root>/.data/local.db.
const client = createClient({
  url: process.env.DATABASE_URL ?? "file:./.data/local.db",
});

export const db = drizzle({ client, schema });
