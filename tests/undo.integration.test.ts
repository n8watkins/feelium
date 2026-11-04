import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "@/db/schema";
import { createBehaviorCategoryForUser } from "@/server/data/behavior-category-operations";
import { createCheckInForUser } from "@/server/data/checkin-writes";
import { createOutcomeForUser } from "@/server/data/outcome-operations";
import {
  deleteCategoryWithUndo,
  deleteCheckInWithUndo,
  deleteOutcomeWithUndo,
  deleteTagWithUndo,
  purgeExpiredUndo,
  undoForUser,
  UNDO_WINDOW_MS,
} from "@/server/data/undo-operations";

const migrationsFolder = resolve("drizzle");

async function setup() {
  const root = await mkdtemp(join(tmpdir(), "feelium-undo-"));
  const client = createClient({ url: `file:${join(root, "test.db")}` });
  await migrate(drizzle(client), { migrationsFolder });
  await client.batch(
    [
      "insert into user (id, email) values ('owner', 'owner@example.test')",
      "insert into user (id, email) values ('other', 'other@example.test')",
    ],
    "write",
  );
  const database = drizzle({ client, schema });
  const mood = await createOutcomeForUser(database, "owner", {
    name: "Mood",
    inputType: "rating",
    desiredDirection: "higher_is_better",
    unit: null,
    description: null,
  });
  const checkInId = await createCheckInForUser(database, "owner", {
    localDate: "2026-11-01",
    note: "Long walk",
    values: [{ outcomeMetricId: mood.id, rating: 4, boolean: null, numeric: null }],
    tagIds: [],
    newTagNames: ["Weekend"],
  });
  return { root, client, database, mood, checkInId };
}

// Everything a check-in is made of, to compare before and after.
async function snapshot(client: Client, checkInId: string) {
  const rows = async (sql: string) => (await client.execute({ sql, args: [checkInId] })).rows.map((row) => ({ ...row }));
  return {
    checkIn: await rows("select * from check_in where id = ?"),
    values: await rows("select * from check_in_value where check_in_id = ? order by id"),
    tags: await rows("select * from check_in_tag where check_in_id = ? order by tag_id"),
  };
}

test("a deleted check-in comes back exactly, once, and only for its owner", async () => {
  const { root, client, database, checkInId } = await setup();
  try {
    const before = await snapshot(client, checkInId);
    const deleted = await deleteCheckInWithUndo(database, "owner", checkInId);
    assert.ok(deleted);
    assert.deepEqual(await snapshot(client, checkInId), { checkIn: [], values: [], tags: [] });

    // Someone else can't delete it or use its Undo.
    assert.equal(await deleteCheckInWithUndo(database, "other", checkInId), null);
    assert.equal(await undoForUser(database, "other", deleted.undoId), null);

    assert.equal(await undoForUser(database, "owner", deleted.undoId), "check_in");
    assert.deepEqual(await snapshot(client, checkInId), before);
    // An Undo works once.
    assert.equal(await undoForUser(database, "owner", deleted.undoId), null);
    assert.equal((await client.execute("select count(*) as n from undo_entry")).rows[0].n, 0);
  } finally {
    client.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("an expired delete is final, and purging removes its snapshot", async () => {
  const { root, client, database, checkInId } = await setup();
  try {
    const deleted = await deleteCheckInWithUndo(database, "owner", checkInId);
    assert.ok(deleted);
    await client.execute({
      sql: "update undo_entry set expires_at = ? where id = ?",
      args: [Math.floor((Date.now() - UNDO_WINDOW_MS) / 1000), deleted.undoId],
    });
    assert.equal(await undoForUser(database, "owner", deleted.undoId), null);
    assert.deepEqual((await snapshot(client, checkInId)).checkIn, []);
    await purgeExpiredUndo(database);
    assert.equal((await client.execute("select count(*) as n from undo_entry")).rows[0].n, 0);
  } finally {
    client.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("a deleted feeling comes back with its answers, whether they were kept or erased", async () => {
  const { root, client, database, mood, checkInId } = await setup();
  try {
    const before = await snapshot(client, checkInId);
    const row = async () => ({ ...(await client.execute({ sql: "select * from outcome_metric where id = ?", args: [mood.id] })).rows[0] });
    const original = await row();

    const kept = await deleteOutcomeWithUndo(database, "owner", mood.id);
    assert.equal(kept?.erased, false);
    assert.ok((await row()).deleted_at);
    assert.equal(await undoForUser(database, "owner", kept!.undoId), "feeling");
    const restored = await row();
    assert.equal(restored.deleted_at, null);
    assert.equal(restored.is_active, original.is_active);
    assert.equal(restored.sort_order, original.sort_order);

    const erased = await deleteOutcomeWithUndo(database, "owner", mood.id, { eraseAnswers: true });
    assert.equal(erased?.erased, true);
    assert.deepEqual((await snapshot(client, checkInId)).values, []);
    assert.equal(await undoForUser(database, "owner", erased!.undoId), "feeling");
    assert.deepEqual(await snapshot(client, checkInId), before);
    assert.equal((await row()).name, "Mood");
  } finally {
    client.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("a deleted tag goes back on its check-ins, and a deleted category on its behaviors", async () => {
  const { root, client, database, checkInId } = await setup();
  try {
    const before = await snapshot(client, checkInId);
    const [tag] = (await client.execute("select id from tag where name = 'Weekend'")).rows;
    const tagDelete = await deleteTagWithUndo(database, "owner", String(tag.id));
    assert.deepEqual((await snapshot(client, checkInId)).tags, []);
    assert.equal(await undoForUser(database, "owner", tagDelete!.undoId), "tag");
    assert.deepEqual(await snapshot(client, checkInId), before);

    const category = await createBehaviorCategoryForUser(database, "owner", "Health");
    await client.execute({
      sql: "insert into behavior (id, user_id, name, input_type, desired_direction, category_id, sort_order, is_active, created_at, updated_at) values ('walk', 'owner', 'Walk', 'boolean', 'increase', ?, 0, 1, 0, 0)",
      args: [category.id],
    });
    const categoryDelete = await deleteCategoryWithUndo(database, "owner", category.id);
    assert.equal((await client.execute("select category_id from behavior where id = 'walk'")).rows[0].category_id, null);
    assert.equal(await undoForUser(database, "owner", categoryDelete!.undoId), "category");
    assert.equal((await client.execute("select category_id from behavior where id = 'walk'")).rows[0].category_id, category.id);
    assert.equal((await client.execute({ sql: "select color from behavior_category where id = ?", args: [category.id] })).rows[0].color, category.color);
  } finally {
    client.close();
    await rm(root, { recursive: true, force: true });
  }
});
