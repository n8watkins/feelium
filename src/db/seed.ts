// Seeds a demo account for local walkthroughs. Run with `npm run db:seed` after
// `npm run db:migrate`.
//
// Idempotent and additive: the demo user, its behaviors/outcomes/tags, and a block of
// historical days are each created only if missing, so re-running is safe and won't
// clobber data the demo has accumulated. To start completely fresh, `npm run db:reset`
// then `npm run db:seed`.
import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "demo12345";

type Db = ReturnType<typeof drizzle<typeof schema>>;

// Active tracking set (PRD 11.2 starter set).
const BEHAVIORS = [
  { name: "Exercise", inputType: "boolean", desiredDirection: "increase", unit: null },
  { name: "Doomscrolling", inputType: "boolean", desiredDirection: "reduce", unit: null },
  { name: "Reading", inputType: "boolean", desiredDirection: "increase", unit: null },
  { name: "Coffee", inputType: "numeric", desiredDirection: "neutral", unit: "cups" },
] as const;

const OUTCOMES = [
  { name: "Mood", inputType: "rating", desiredDirection: "higher_is_better", unit: null },
  { name: "Anxiety", inputType: "rating", desiredDirection: "lower_is_better", unit: null },
  { name: "Energy", inputType: "rating", desiredDirection: "higher_is_better", unit: null },
  { name: "Focus", inputType: "rating", desiredDirection: "higher_is_better", unit: null },
  { name: "Headache", inputType: "boolean", desiredDirection: "lower_is_better", unit: null },
  { name: "Hours slept", inputType: "numeric", desiredDirection: null, unit: "hours" },
] as const;

const TAG_NAMES = ["Work", "Poor sleep", "Weekend"] as const;

// Archived metrics kept only to demonstrate that history never hides data behind a later
// archive (PRD 15.2, 16.6). They have recorded values on the historical days below but do
// not appear in active tracking.
const ARCHIVED_BEHAVIOR = {
  name: "Meditation",
  inputType: "boolean",
  desiredDirection: "increase",
  unit: null,
} as const;

const ARCHIVED_OUTCOME = {
  name: "Screen time",
  inputType: "numeric",
  desiredDirection: "lower_is_better",
  unit: "hours",
} as const;

// Historical days, relative to "today" so the demo always looks recent. Behaviors omitted
// from a day stay unknown (no entry). Gaps between offsets show that only days with data
// appear in the list.
type CheckInPlan = {
  hour: number;
  minute: number;
  values: {
    outcome: string;
    rating?: number;
    boolean?: boolean;
    numeric?: number;
  }[];
  tags?: string[];
  note?: string | null;
};

type DayPlan = {
  offset: number; // days ago
  behaviors: { name: string; boolean?: boolean; numeric?: number }[];
  checkIns: CheckInPlan[];
};

const DAY_PLANS: DayPlan[] = [
  {
    offset: 1,
    behaviors: [
      { name: "Exercise", boolean: true },
      { name: "Doomscrolling", boolean: false },
      { name: "Reading", boolean: true },
      { name: "Coffee", numeric: 2 },
      { name: "Meditation", boolean: true },
    ],
    checkIns: [
      {
        hour: 8,
        minute: 30,
        values: [
          { outcome: "Mood", rating: 4 },
          { outcome: "Anxiety", rating: 2 },
          { outcome: "Energy", rating: 4 },
          { outcome: "Focus", rating: 4 },
          { outcome: "Hours slept", numeric: 7.5 },
          { outcome: "Screen time", numeric: 3 },
        ],
        tags: ["Work"],
        note: "Focused morning, good energy.",
      },
      {
        hour: 21,
        minute: 0,
        values: [
          { outcome: "Mood", rating: 3 },
          { outcome: "Anxiety", rating: 3 },
          { outcome: "Focus", rating: 3 },
        ],
        tags: ["Work"],
        note: "Faded a bit by the evening.",
      },
    ],
  },
  {
    offset: 2,
    behaviors: [
      { name: "Exercise", boolean: false },
      { name: "Doomscrolling", boolean: true },
      { name: "Reading", boolean: false },
      { name: "Coffee", numeric: 3 },
      { name: "Meditation", boolean: false },
    ],
    checkIns: [
      {
        hour: 9,
        minute: 15,
        values: [
          { outcome: "Mood", rating: 2 },
          { outcome: "Anxiety", rating: 4 },
          { outcome: "Energy", rating: 2 },
          { outcome: "Focus", rating: 2 },
          { outcome: "Headache", boolean: true },
          { outcome: "Hours slept", numeric: 5 },
          { outcome: "Screen time", numeric: 5 },
        ],
        tags: ["Poor sleep"],
        note: "Rough night, a headache lingered.",
      },
    ],
  },
  {
    offset: 3,
    behaviors: [
      { name: "Exercise", boolean: true },
      { name: "Reading", boolean: true },
      { name: "Coffee", numeric: 1 },
      { name: "Meditation", boolean: true },
    ],
    checkIns: [
      {
        hour: 12,
        minute: 30,
        values: [
          { outcome: "Mood", rating: 4 },
          { outcome: "Energy", rating: 3 },
          { outcome: "Focus", rating: 4 },
          { outcome: "Hours slept", numeric: 8 },
        ],
        tags: [],
        note: null,
      },
    ],
  },
  {
    offset: 4,
    behaviors: [
      { name: "Doomscrolling", boolean: true },
      { name: "Coffee", numeric: 4 },
    ],
    checkIns: [
      {
        hour: 20,
        minute: 0,
        values: [
          { outcome: "Mood", rating: 3 },
          { outcome: "Anxiety", rating: 3 },
          { outcome: "Hours slept", numeric: 6.5 },
        ],
        tags: ["Weekend"],
        note: "Slow, restful day.",
      },
    ],
  },
  {
    offset: 5,
    behaviors: [
      { name: "Exercise", boolean: true },
      { name: "Doomscrolling", boolean: false },
      { name: "Reading", boolean: true },
      { name: "Coffee", numeric: 2 },
    ],
    checkIns: [
      {
        hour: 7,
        minute: 45,
        values: [
          { outcome: "Mood", rating: 5 },
          { outcome: "Anxiety", rating: 1 },
          { outcome: "Energy", rating: 5 },
          { outcome: "Focus", rating: 5 },
          { outcome: "Hours slept", numeric: 8 },
        ],
        tags: ["Weekend"],
        note: "Great day outdoors with friends.",
      },
    ],
  },
  {
    offset: 7,
    behaviors: [
      { name: "Exercise", boolean: false },
      { name: "Coffee", numeric: 2 },
    ],
    checkIns: [
      {
        hour: 10,
        minute: 0,
        values: [
          { outcome: "Mood", rating: 3 },
          { outcome: "Focus", rating: 3 },
        ],
        tags: ["Work"],
        note: null,
      },
    ],
  },
  {
    offset: 9,
    behaviors: [
      { name: "Exercise", boolean: true },
      { name: "Reading", boolean: true },
      { name: "Coffee", numeric: 3 },
      { name: "Meditation", boolean: true },
    ],
    checkIns: [
      {
        hour: 8,
        minute: 0,
        values: [
          { outcome: "Mood", rating: 4 },
          { outcome: "Anxiety", rating: 2 },
          { outcome: "Energy", rating: 4 },
          { outcome: "Focus", rating: 4 },
          { outcome: "Hours slept", numeric: 7 },
          { outcome: "Screen time", numeric: 2 },
        ],
        tags: ["Work"],
        note: "Eased back into the routine.",
      },
    ],
  },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD, local calendar
}

function dateAtDaysAgo(days: number, hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Finds the demo user or creates it (with a profile). */
async function ensureUser(db: Db): Promise<string> {
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, DEMO_EMAIL))
    .limit(1);
  if (existing) return existing.id;

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const [user] = await db
    .insert(schema.users)
    .values({ email: DEMO_EMAIL, passwordHash })
    .returning({ id: schema.users.id });
  await db.insert(schema.profiles).values({ userId: user.id });
  return user.id;
}

/** Inserts any behaviors that don't already exist for the user (matched by name). */
async function ensureBehaviors(db: Db, userId: string) {
  const existing = await db
    .select({ name: schema.behaviors.name })
    .from(schema.behaviors)
    .where(eq(schema.behaviors.userId, userId));
  const have = new Set(existing.map((r) => r.name));

  const rows = [
    ...BEHAVIORS.map((b, index) => ({ ...b, sortOrder: index })),
    // Archived: inactive, sorted after the active set, marked archived.
    {
      ...ARCHIVED_BEHAVIOR,
      sortOrder: BEHAVIORS.length,
      isActive: false,
      archivedAt: new Date(),
    },
  ].filter((b) => !have.has(b.name));

  if (rows.length > 0) {
    await db.insert(schema.behaviors).values(rows.map((b) => ({ userId, ...b })));
  }
}

/** Inserts any outcome metrics that don't already exist for the user (matched by name). */
async function ensureOutcomes(db: Db, userId: string) {
  const existing = await db
    .select({ name: schema.outcomeMetrics.name })
    .from(schema.outcomeMetrics)
    .where(eq(schema.outcomeMetrics.userId, userId));
  const have = new Set(existing.map((r) => r.name));

  const rows = [
    ...OUTCOMES.map((o, index) => ({ ...o, sortOrder: index })),
    {
      ...ARCHIVED_OUTCOME,
      sortOrder: OUTCOMES.length,
      isActive: false,
      archivedAt: new Date(),
    },
  ].filter((o) => !have.has(o.name));

  if (rows.length > 0) {
    await db
      .insert(schema.outcomeMetrics)
      .values(rows.map((o) => ({ userId, ...o })));
  }
}

async function ensureTags(db: Db, userId: string) {
  await db
    .insert(schema.tags)
    .values(TAG_NAMES.map((name) => ({ userId, name })))
    .onConflictDoNothing({ target: [schema.tags.userId, schema.tags.name] });
}

async function nameToId(
  rows: { id: string; name: string }[],
): Promise<Map<string, string>> {
  return new Map(rows.map((r) => [r.name, r.id]));
}

/**
 * Seeds the historical days, but only when the user has no entries and no check-ins yet,
 * so re-running never duplicates history or overwrites live demo activity.
 */
async function ensureHistory(db: Db, userId: string) {
  const [entry] = await db
    .select({ id: schema.dailyBehaviorEntries.id })
    .from(schema.dailyBehaviorEntries)
    .where(eq(schema.dailyBehaviorEntries.userId, userId))
    .limit(1);
  const [checkIn] = await db
    .select({ id: schema.checkIns.id })
    .from(schema.checkIns)
    .where(eq(schema.checkIns.userId, userId))
    .limit(1);
  if (entry || checkIn) {
    console.log("History already present - skipping historical seed.");
    return;
  }

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

  // Daily behavior entries.
  const entryRows = DAY_PLANS.flatMap((day) => {
    const entryDate = isoDaysAgo(day.offset);
    return day.behaviors.map((b) => ({
      userId,
      behaviorId: behaviorId.get(b.name)!,
      entryDate,
      booleanValue: b.boolean ?? null,
      numericValue: b.numeric ?? null,
    }));
  });
  if (entryRows.length > 0) {
    await db.insert(schema.dailyBehaviorEntries).values(entryRows);
  }

  // Check-ins with their values and tag links.
  let checkInCount = 0;
  for (const day of DAY_PLANS) {
    const localDate = isoDaysAgo(day.offset);
    for (const ci of day.checkIns) {
      const occurredAt = dateAtDaysAgo(day.offset, ci.hour, ci.minute);
      const [row] = await db
        .insert(schema.checkIns)
        .values({ userId, localDate, occurredAt, note: ci.note ?? null })
        .returning({ id: schema.checkIns.id });
      const checkInId = row.id;
      checkInCount += 1;

      if (ci.values.length > 0) {
        await db.insert(schema.checkInValues).values(
          ci.values.map((v) => ({
            userId,
            checkInId,
            outcomeMetricId: outcomeId.get(v.outcome)!,
            ratingValue: v.rating ?? null,
            booleanValue: v.boolean ?? null,
            numericValue: v.numeric ?? null,
          })),
        );
      }

      if (ci.tags && ci.tags.length > 0) {
        await db
          .insert(schema.checkInTags)
          .values(ci.tags.map((name) => ({ checkInId, tagId: tagId.get(name)! })));
      }
    }
  }

  console.log(
    `Seeded ${DAY_PLANS.length} historical days: ${entryRows.length} behavior entries, ${checkInCount} check-ins.`,
  );
}

async function main() {
  const client = createClient({
    url: process.env.DATABASE_URL ?? "file:./.data/local.db",
  });
  const db = drizzle({ client, schema });

  const userId = await ensureUser(db);
  await ensureBehaviors(db, userId);
  await ensureOutcomes(db, userId);
  await ensureTags(db, userId);
  await ensureHistory(db, userId);

  console.log(`Demo account ready: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
