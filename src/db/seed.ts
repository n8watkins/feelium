// Seeds a demo account for local walkthroughs. Run with `npm run db:seed` after
// `npm run db:migrate`. Idempotent: skips creation if the demo user already exists.
import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "demo12345";

const STARTER_BEHAVIORS = [
  { name: "Exercise", inputType: "boolean", desiredDirection: "increase", unit: null },
  { name: "Doomscrolling", inputType: "boolean", desiredDirection: "reduce", unit: null },
  { name: "Reading", inputType: "boolean", desiredDirection: "increase", unit: null },
  { name: "Coffee", inputType: "numeric", desiredDirection: "neutral", unit: "cups" },
] as const;

const STARTER_OUTCOMES = [
  { name: "Mood", inputType: "rating", desiredDirection: "higher_is_better", unit: null },
  { name: "Anxiety", inputType: "rating", desiredDirection: "lower_is_better", unit: null },
  { name: "Energy", inputType: "rating", desiredDirection: "higher_is_better", unit: null },
  { name: "Focus", inputType: "rating", desiredDirection: "higher_is_better", unit: null },
  { name: "Headache", inputType: "boolean", desiredDirection: "lower_is_better", unit: null },
  { name: "Hours slept", inputType: "numeric", desiredDirection: null, unit: "hours" },
] as const;

async function main() {
  const client = createClient({
    url: process.env.DATABASE_URL ?? "file:./.data/local.db",
  });
  const db = drizzle({ client, schema });

  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, DEMO_EMAIL))
    .limit(1);

  if (existing) {
    console.log(`Demo user already exists: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
    client.close();
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const [user] = await db
    .insert(schema.users)
    .values({ email: DEMO_EMAIL, passwordHash })
    .returning({ id: schema.users.id });
  const userId = user.id;

  await db.insert(schema.profiles).values({ userId });
  await db.insert(schema.behaviors).values(
    STARTER_BEHAVIORS.map((b, index) => ({ userId, ...b, sortOrder: index })),
  );
  await db.insert(schema.outcomeMetrics).values(
    STARTER_OUTCOMES.map((o, index) => ({ userId, ...o, sortOrder: index })),
  );
  await db
    .insert(schema.tags)
    .values(["Work", "Poor sleep", "Weekend"].map((name) => ({ userId, name })));

  console.log(`Seeded demo account: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
