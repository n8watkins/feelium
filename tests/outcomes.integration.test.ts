import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "@/db/schema";
import { createCheckInForUser } from "@/server/data/checkin-writes";
import {
  archiveOutcomeForUser,
  countAnswersByOutcomeForUser,
  createOutcomeForUser,
  deleteOutcomeForUser,
  getOutcomeForUser,
  listActiveOutcomesForUser,
  listOutcomesForUser,
  moveOutcomeForUser,
  reactivateOutcomeForUser,
  updateOutcomeForUser,
} from "@/server/data/outcome-operations";

const migrationsFolder = resolve("drizzle");

async function createTestDatabase() {
  const root = await mkdtemp(join(tmpdir(), "feelium-outcomes-"));
  const client = createClient({ url: `file:${join(root, "test.db")}` });
  await migrate(drizzle(client), { migrationsFolder });
  await client.batch(
    [
      "insert into user (id, email) values ('owner', 'owner@example.test')",
      "insert into user (id, email) values ('other', 'other@example.test')",
    ],
    "write",
  );
  return { root, client, database: drizzle({ client, schema }) };
}

const rating = (name: string) => ({
  name,
  inputType: "rating" as const,
  desiredDirection: "higher_is_better" as const,
  unit: null,
  description: null,
});

const names = (rows: { name: string }[]) => rows.map((row) => row.name);

async function answer(database: Awaited<ReturnType<typeof createTestDatabase>>["database"], ids: string[]) {
  return createCheckInForUser(database, "owner", {
    localDate: "2026-11-01",
    note: null,
    values: ids.map((outcomeMetricId) => ({ outcomeMetricId, rating: 3, boolean: null, numeric: null })),
    tagIds: [],
    newTagNames: [],
  });
}

test("feelings can be added, renamed, reordered, archived and restored in place", async () => {
  const { root, client, database } = await createTestDatabase();
  try {
    const mood = await createOutcomeForUser(database, "owner", rating("Mood"));
    const anxiety = await createOutcomeForUser(database, "owner", rating("Anxiety"));
    const energy = await createOutcomeForUser(database, "owner", rating("Energy"));
    const focus = await createOutcomeForUser(database, "owner", rating("Focus"));

    await updateOutcomeForUser(database, "owner", anxiety.id, { ...rating("Calm"), desiredDirection: null });
    assert.equal((await getOutcomeForUser(database, "owner", anxiety.id))?.name, "Calm");
    // Another user can't touch it.
    await assert.rejects(updateOutcomeForUser(database, "other", anxiety.id, rating("Hijack")), /NOT_FOUND/);

    // Archive Energy, then move Focus up: it passes Energy's slot and lands above Calm.
    await archiveOutcomeForUser(database, "owner", energy.id);
    await moveOutcomeForUser(database, "owner", focus.id, "up");
    assert.deepEqual(names(await listActiveOutcomesForUser(database, "owner")), ["Mood", "Focus", "Calm"]);
    // Out-of-range moves and other users' moves change nothing.
    await moveOutcomeForUser(database, "owner", mood.id, "up");
    await moveOutcomeForUser(database, "other", focus.id, "up");
    assert.deepEqual(names(await listActiveOutcomesForUser(database, "owner")), ["Mood", "Focus", "Calm"]);

    // Restoring Energy puts it back in the slot it kept, not at the end.
    await reactivateOutcomeForUser(database, "owner", energy.id);
    assert.deepEqual(names(await listActiveOutcomesForUser(database, "owner")), ["Mood", "Focus", "Energy", "Calm"]);

    // A new feeling goes after everything, archived ones included.
    await archiveOutcomeForUser(database, "owner", energy.id);
    await createOutcomeForUser(database, "owner", rating("Sleep"));
    await reactivateOutcomeForUser(database, "owner", energy.id);
    assert.deepEqual(names(await listActiveOutcomesForUser(database, "owner")), ["Mood", "Focus", "Energy", "Calm", "Sleep"]);
  } finally {
    client.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("deleting a feeling keeps its past answers unless they are erased too", async () => {
  const { root, client, database } = await createTestDatabase();
  try {
    const mood = await createOutcomeForUser(database, "owner", rating("Mood"));
    const anxiety = await createOutcomeForUser(database, "owner", rating("Anxiety"));
    const focus = await createOutcomeForUser(database, "owner", rating("Focus"));
    const unused = await createOutcomeForUser(database, "owner", rating("Unused"));
    await answer(database, [mood.id, anxiety.id, focus.id]);
    await answer(database, [anxiety.id]);

    // Another user can't delete it.
    assert.equal(await deleteOutcomeForUser(database, "other", anxiety.id), null);

    // With answers: it leaves every list, the answers stay.
    assert.equal(await deleteOutcomeForUser(database, "owner", anxiety.id), "kept-answers");
    assert.deepEqual(names(await listOutcomesForUser(database, "owner")), ["Mood", "Focus", "Unused"]);
    assert.deepEqual(names(await listActiveOutcomesForUser(database, "owner")), ["Mood", "Focus", "Unused"]);
    assert.equal(await getOutcomeForUser(database, "owner", anxiety.id), null);
    assert.equal((await countAnswersByOutcomeForUser(database, "owner")).get(anxiety.id), 2);
    const kept = (await listOutcomesForUser(database, "owner", { includeDeleted: true })).find((row) => row.id === anxiety.id);
    assert.ok(kept?.deletedAt);
    assert.equal(kept?.isActive, false);
    // A deleted feeling can't be restored, renamed or deleted twice.
    await reactivateOutcomeForUser(database, "owner", anxiety.id);
    assert.equal(await getOutcomeForUser(database, "owner", anxiety.id), null);
    assert.equal(await deleteOutcomeForUser(database, "owner", anxiety.id), null);

    // Erasing: the feeling and its answers go; other feelings' answers stay.
    assert.equal(await deleteOutcomeForUser(database, "owner", focus.id, { eraseAnswers: true }), "erased");
    const counts = await countAnswersByOutcomeForUser(database, "owner");
    assert.equal(counts.get(focus.id), undefined);
    assert.equal(counts.get(mood.id), 1);
    assert.equal(
      (await listOutcomesForUser(database, "owner", { includeDeleted: true })).some((row) => row.id === focus.id),
      false,
    );

    // Never answered: removed outright.
    assert.equal(await deleteOutcomeForUser(database, "owner", unused.id), "erased");
    assert.deepEqual(names(await listOutcomesForUser(database, "owner", { includeDeleted: true })), ["Mood", "Anxiety"]);
  } finally {
    client.close();
    await rm(root, { recursive: true, force: true });
  }
});
