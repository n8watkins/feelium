/**
 * Integration test: check-ins must persist on a libSQL/Turso target over HTTP.
 *
 * This guards the P0 regression where an interactive `db.transaction()` silently failed to
 * commit on Turso, so a saved check-in vanished. It exercises the REAL write functions
 * (createCheckInForUser / updateCheckInForUser from src/server/data/checkin-writes) against
 * a libSQL server reached over HTTP - the same transport Turso uses - and asserts the
 * check-in, its outcome values, and its tags actually land in the database.
 *
 * Run:  npm run test:persistence
 * It needs an explicitly configured disposable libSQL server at TEST_LIBSQL_URL. Start one
 * with: turso dev --port 8080, then set TEST_LIBSQL_URL=http://127.0.0.1:8080.
 */
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import {
  createCheckInForUser,
  updateCheckInForUser,
} from "@/server/data/checkin-writes";
import * as schema from "@/db/schema";

const {
  users,
  outcomeMetrics,
  tags,
  checkIns,
  checkInValues,
  checkInTags,
} = schema;

const authToken = process.env.TEST_LIBSQL_AUTH_TOKEN;

let passed = 0;
let failed = 0;
function assert(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` - ${detail}` : ""}`);
  }
}

async function main(url: string) {
  const client = createClient(authToken ? { url, authToken } : { url });
  const db = drizzle({ client, schema });
  console.log(`Target: ${url} (libSQL over HTTP)\n`);

  // Ensure the schema is present (idempotent).
  await migrate(db, { migrationsFolder: "./drizzle" });

  const userId = `test-${crypto.randomUUID()}`;
  const ratingOutcomeId = crypto.randomUUID();
  const numericOutcomeId = crypto.randomUUID();
  const existingTagId = crypto.randomUUID();
  const newTagName = `focus-${Date.now()}`;
  const note = `persist-me-${Date.now()}`;

  try {
    // --- fixtures (single-statement writes, always fine) --------------------------------
    await db
      .insert(users)
      .values({ id: userId, email: `${userId}@throwaway.invalid` });
    await db.insert(outcomeMetrics).values([
      {
        id: ratingOutcomeId,
        userId,
        name: "Mood",
        inputType: "rating",
        desiredDirection: "higher_is_better",
      },
      {
        id: numericOutcomeId,
        userId,
        name: "Hours slept",
        inputType: "numeric",
        unit: "hours",
      },
    ]);
    await db.insert(tags).values({ id: existingTagId, userId, name: "Work" });

    // --- CREATE: rating answered, numeric left blank, one existing + one new tag, a note --
    const checkInId = await createCheckInForUser(db, userId, {
      localDate: "2026-07-10",
      note,
      values: [
        { outcomeMetricId: ratingOutcomeId, rating: 4, boolean: null, numeric: null },
        // Left entirely blank -> must stay UNKNOWN (no row), never silently become 0.
        { outcomeMetricId: numericOutcomeId, rating: null, boolean: null, numeric: null },
      ],
      tagIds: [existingTagId],
      newTagNames: [newTagName],
    });

    const ci = await db.select().from(checkIns).where(eq(checkIns.id, checkInId));
    assert("check-in row persisted", ci.length === 1, `rows=${ci.length}`);
    assert("note persisted", ci[0]?.note === note, `note=${ci[0]?.note}`);

    const vals = await db
      .select()
      .from(checkInValues)
      .where(eq(checkInValues.checkInId, checkInId));
    assert(
      "exactly one outcome value persisted (blank outcome stayed unknown)",
      vals.length === 1,
      `values=${vals.length}`,
    );
    assert(
      "the answered rating value is 4",
      vals[0]?.ratingValue === 4,
      `rating=${vals[0]?.ratingValue}`,
    );

    const tagRows = await db
      .select({ name: tags.name })
      .from(checkInTags)
      .innerJoin(tags, eq(tags.id, checkInTags.tagId))
      .where(eq(checkInTags.checkInId, checkInId));
    const tagNames = tagRows.map((r) => r.name).sort();
    assert(
      "both the existing and the new tag persisted",
      tagNames.length === 2 && tagNames.includes("Work") && tagNames.includes(newTagName),
      `tags=${JSON.stringify(tagNames)}`,
    );

    // --- UPDATE: change note + rating, drop the new tag ---------------------------------
    const newNote = `${note}-edited`;
    const ok = await updateCheckInForUser(db, userId, checkInId, {
      localDate: "2026-07-10",
      note: newNote,
      values: [
        { outcomeMetricId: ratingOutcomeId, rating: 2, boolean: null, numeric: null },
        { outcomeMetricId: numericOutcomeId, rating: null, boolean: null, numeric: 7 },
      ],
      tagIds: [existingTagId],
      newTagNames: [],
    });
    assert("update reported success", ok === true);

    const ci2 = await db.select().from(checkIns).where(eq(checkIns.id, checkInId));
    assert("edited note persisted", ci2[0]?.note === newNote, `note=${ci2[0]?.note}`);

    const vals2 = await db
      .select()
      .from(checkInValues)
      .where(eq(checkInValues.checkInId, checkInId));
    const ratingRow = vals2.find((v) => v.outcomeMetricId === ratingOutcomeId);
    const numericRow = vals2.find((v) => v.outcomeMetricId === numericOutcomeId);
    assert(
      "rating replaced to 2 and numeric now recorded as 7",
      vals2.length === 2 && ratingRow?.ratingValue === 2 && numericRow?.numericValue === 7,
      `values=${JSON.stringify(vals2.map((v) => ({ r: v.ratingValue, n: v.numericValue })))}`,
    );

    const tagRows2 = await db
      .select({ name: tags.name })
      .from(checkInTags)
      .innerJoin(tags, eq(tags.id, checkInTags.tagId))
      .where(eq(checkInTags.checkInId, checkInId));
    assert(
      "tags replaced to just the kept one",
      tagRows2.length === 1 && tagRows2[0]?.name === "Work",
      `tags=${JSON.stringify(tagRows2.map((r) => r.name))}`,
    );

    // --- update of a foreign check-in is rejected --------------------------------------
    const rejected = await updateCheckInForUser(db, "someone-else", checkInId, {
      localDate: "2026-07-10",
      note: "hax",
      values: [],
      tagIds: [],
      newTagNames: [],
    });
    assert("update by a non-owner returns false", rejected === false);
  } finally {
    // Clean up the throwaway user and everything scoped to it.
    await db.delete(checkInValues).where(eq(checkInValues.userId, userId)).catch(() => {});
    const owned = await db
      .select({ id: checkIns.id })
      .from(checkIns)
      .where(eq(checkIns.userId, userId));
    for (const c of owned) {
      await db.delete(checkInTags).where(eq(checkInTags.checkInId, c.id)).catch(() => {});
    }
    await db.delete(checkIns).where(eq(checkIns.userId, userId)).catch(() => {});
    await db.delete(tags).where(eq(tags.userId, userId)).catch(() => {});
    await db.delete(outcomeMetrics).where(eq(outcomeMetrics.userId, userId)).catch(() => {});
    await db.delete(users).where(eq(users.id, userId)).catch(() => {});
    client.close();
  }

  console.log(`\n${passed}/${passed + failed} assertions passed`);
  if (failed > 0) process.exit(1);
}

const url = process.env.TEST_LIBSQL_URL;
if (!url) {
  console.log("SKIP: Set TEST_LIBSQL_URL to run the libSQL transport persistence test.");
} else {
  main(url).catch((e) => {
    console.error("\nTEST ERROR:", e instanceof Error ? e.message : e);
    console.error("\nCould not use the disposable libSQL target at", url);
    process.exit(1);
  });
}
