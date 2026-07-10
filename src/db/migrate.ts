// Standalone migration runner (run via `tsx src/db/migrate.ts`). The primary local
// workflow is `npm run db:migrate` (drizzle-kit); this script is the deploy/startup
// equivalent that applies migrations using the libSQL client directly.
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

async function main() {
  const client = createClient({
    url: process.env.DATABASE_URL ?? "file:./.data/local.db",
  });
  const db = drizzle({ client });
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
