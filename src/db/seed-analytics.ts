// Seeds a rich, deterministic 90-day history for the demo account so the Insights tab
// (PRD 16) has enough data to cross the comparison thresholds (16.5). Run AFTER the base
// seed, which creates the demo user, behaviors, and outcome metrics:
//
//   npm run db:reset && npm run db:seed && npx tsx src/db/seed-analytics.ts
//
// It replaces the demo user's behavior entries and check-ins with a generated block whose
// associations are intentional but noisy - e.g. anxiety tends to run higher on days when
// doomscrolling was recorded - so the Yes-vs-No comparison, daily averages, missing-data
// handling, and archived-metric inclusion can all be verified end to end. Deterministic
// (fixed PRNG seed) so the same data regenerates every run.
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

const DEMO_EMAIL = "demo@example.com";
const DAYS = 90;

type Db = ReturnType<typeof drizzle<typeof schema>>;

// Small deterministic PRNG (mulberry32) so the generated history is stable across runs.
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString("en-CA");
}

function dateAtDaysAgo(days: number, hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function clampRound(value: number, min: number, max: number, step = 1): number {
  const snapped = Math.round(value / step) * step;
  return Math.max(min, Math.min(max, snapped));
}

/** A rating 1-5, jittered per check-in so multi-check-in days produce fractional averages. */
function rating(base: number, rng: () => number): number {
  return clampRound(base + (rng() - 0.5) * 1.4, 1, 5);
}

async function nameToId(rows: { id: string; name: string }[]): Promise<Map<string, string>> {
  return new Map(rows.map((r) => [r.name, r.id]));
}

type ValuePlan = {
  outcome: string;
  rating?: number;
  boolean?: boolean;
  numeric?: number;
};

async function main() {
  const client = createClient({
    url: process.env.DATABASE_URL ?? "file:./.data/local.db",
  });
  const db: Db = drizzle({ client, schema });

  const [user] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, DEMO_EMAIL))
    .limit(1);
  if (!user) {
    console.error(
      `Demo user ${DEMO_EMAIL} not found. Run \`npm run db:seed\` first, then this script.`,
    );
    client.close();
    process.exit(1);
  }
  const userId = user.id;

  const behaviorId = await nameToId(
    await db
      .select({ id: schema.behaviors.id, name: schema.behaviors.name })
      .from(schema.behaviors)
      .where(eq(schema.behaviors.userId, userId)),
  );
  const outcomeId = await nameToId(
    await db
      .select({ id: schema.outcomeMetrics.id, name: schema.outcomeMetrics.name })
      .from(schema.outcomeMetrics)
      .where(eq(schema.outcomeMetrics.userId, userId)),
  );
  const tagId = await nameToId(
    await db
      .select({ id: schema.tags.id, name: schema.tags.name })
      .from(schema.tags)
      .where(eq(schema.tags.userId, userId)),
  );

  const required = [
    "Doomscrolling",
    "Exercise",
    "Reading",
    "Coffee",
    "Anxiety",
    "Mood",
    "Energy",
    "Focus",
    "Headache",
    "Hours slept",
  ];
  const missing = required.filter(
    (n) => !behaviorId.has(n) && !outcomeId.has(n),
  );
  if (missing.length > 0) {
    console.error(`Missing seeded metrics: ${missing.join(", ")}. Run \`npm run db:seed\` first.`);
    client.close();
    process.exit(1);
  }

  // Replace any existing history for a clean, known dataset (check-in values and tag links
  // cascade on delete via their foreign keys).
  await db.delete(schema.checkIns).where(eq(schema.checkIns.userId, userId));
  await db
    .delete(schema.dailyBehaviorEntries)
    .where(eq(schema.dailyBehaviorEntries.userId, userId));

  const rng = makeRng(20260710);

  const entryRows: (typeof schema.dailyBehaviorEntries.$inferInsert)[] = [];
  let checkInCount = 0;
  let valueCount = 0;

  const pushEntry = (
    name: string,
    entryDate: string,
    value: { boolean?: boolean; numeric?: number },
  ) => {
    const id = behaviorId.get(name);
    if (!id) return;
    entryRows.push({
      userId,
      behaviorId: id,
      entryDate,
      booleanValue: value.boolean ?? null,
      numericValue: value.numeric ?? null,
    });
  };

  // Build all check-ins in a plan first, then insert. We insert check-ins one at a time to
  // capture their generated ids for the value/tag rows.
  type CheckInPlan = {
    localDate: string;
    occurredAt: Date;
    note: string | null;
    values: ValuePlan[];
    tags: string[];
  };
  const checkInPlans: CheckInPlan[] = [];

  for (let offset = DAYS; offset >= 1; offset--) {
    const entryDate = isoDaysAgo(offset);

    // Latent daily state.
    const doom = rng() < 0.5;
    const exercise = rng() < 0.45;
    const reading = rng() < 0.42;
    const meditation = rng() < 0.3;
    const coffeeCups = rng() < 0.22 ? 0 : clampRound(1 + rng() * 3.4, 1, 4);

    // Behavior entries, with occasional unrecorded (unknown) days per behavior.
    if (rng() > 0.1) pushEntry("Doomscrolling", entryDate, { boolean: doom });
    if (rng() > 0.12) pushEntry("Exercise", entryDate, { boolean: exercise });
    if (rng() > 0.2) pushEntry("Reading", entryDate, { boolean: reading });
    if (rng() > 0.15) pushEntry("Coffee", entryDate, { numeric: coffeeCups });
    // Archived behavior still gets recorded values -> should appear in historical analytics.
    if (behaviorId.has("Meditation") && rng() > 0.4) {
      pushEntry("Meditation", entryDate, { boolean: meditation });
    }

    // Outcome bases driven by the day's behaviors (association, not causation).
    const anxietyBase =
      (doom ? 3.8 : 2.4) + (exercise ? -0.6 : 0.1) + coffeeCups * 0.12;
    const moodBase = 5.6 - anxietyBase + (exercise ? 0.5 : 0) + (reading ? 0.3 : 0);
    const energyBase = (exercise ? 4.1 : 2.9) + (doom ? -0.3 : 0.2);
    const focusBase = energyBase - (doom ? 0.5 : 0) - coffeeCups * 0.05;
    const sleptBase = 7.6 - (doom ? 1.1 : 0) + (exercise ? 0.3 : 0);
    const screenBase = 1.8 + (doom ? 3.2 : 0.4);

    // 0-2 check-ins per day (mostly 1, sometimes 2, occasionally none).
    const roll = rng();
    const numCheckIns = roll < 0.08 ? 0 : roll < 0.38 ? 2 : 1;

    for (let c = 0; c < numCheckIns; c++) {
      const hour = c === 0 ? 8 + Math.floor(rng() * 3) : 20 + Math.floor(rng() * 2);
      const minute = Math.floor(rng() * 60);
      const values: ValuePlan[] = [];

      if (rng() > 0.08) values.push({ outcome: "Anxiety", rating: rating(anxietyBase, rng) });
      if (rng() > 0.15) values.push({ outcome: "Mood", rating: rating(moodBase, rng) });
      if (rng() > 0.2) values.push({ outcome: "Energy", rating: rating(energyBase, rng) });
      if (rng() > 0.2) values.push({ outcome: "Focus", rating: rating(focusBase, rng) });
      if (rng() > 0.5) {
        const headache = rng() < (anxietyBase >= 3.5 ? 0.5 : 0.15);
        values.push({ outcome: "Headache", boolean: headache });
      }
      if (c === 0 && rng() > 0.3) {
        values.push({ outcome: "Hours slept", numeric: clampRound(sleptBase + (rng() - 0.5) * 1.5, 3, 10, 0.5) });
      }
      // Archived outcome still recorded on some days -> appears in historical analytics.
      if (outcomeId.has("Screen time") && rng() > 0.6) {
        values.push({ outcome: "Screen time", numeric: clampRound(screenBase + (rng() - 0.5) * 1.5, 0.5, 9, 0.5) });
      }

      if (values.length === 0) continue;

      const tags: string[] = [];
      if (tagId.has("Work") && hour < 18 && rng() > 0.5) tags.push("Work");
      if (tagId.has("Poor sleep") && sleptBase < 7 && rng() > 0.5) tags.push("Poor sleep");

      checkInPlans.push({
        localDate: entryDate,
        occurredAt: dateAtDaysAgo(offset, hour, minute),
        note: null,
        values,
        tags,
      });
    }
  }

  if (entryRows.length > 0) {
    await db.insert(schema.dailyBehaviorEntries).values(entryRows);
  }

  for (const plan of checkInPlans) {
    const [row] = await db
      .insert(schema.checkIns)
      .values({
        userId,
        localDate: plan.localDate,
        occurredAt: plan.occurredAt,
        note: plan.note,
      })
      .returning({ id: schema.checkIns.id });
    checkInCount += 1;

    await db.insert(schema.checkInValues).values(
      plan.values.map((v) => ({
        userId,
        checkInId: row.id,
        outcomeMetricId: outcomeId.get(v.outcome)!,
        ratingValue: v.rating ?? null,
        booleanValue: v.boolean ?? null,
        numericValue: v.numeric ?? null,
      })),
    );
    valueCount += plan.values.length;

    if (plan.tags.length > 0) {
      await db
        .insert(schema.checkInTags)
        .values(plan.tags.map((name) => ({ checkInId: row.id, tagId: tagId.get(name)! })));
    }
  }

  console.log(
    `Seeded ${DAYS} days of analytics history for ${DEMO_EMAIL}: ` +
      `${entryRows.length} behavior entries, ${checkInCount} check-ins, ${valueCount} outcome values.`,
  );
  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
