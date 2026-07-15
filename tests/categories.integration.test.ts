import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "@/db/schema";
import {
  createBehaviorCategoryForUser,
  deleteBehaviorCategoryForUser,
  listBehaviorCategoriesForUser,
  moveBehaviorCategoryForUser,
  resolveOwnedBehaviorCategoryId,
  updateBehaviorCategoryForUser,
} from "@/server/data/behavior-category-operations";
import {
  deleteAllTrackingDataForUser,
  exportUserDataForUser,
} from "@/server/data/account-ops";

const migrationsFolder = resolve("drizzle");

async function createTestDatabase() {
  const root = await mkdtemp(join(tmpdir(), "feelium-categories-"));
  const client = createClient({ url: `file:${join(root, "test.db")}` });
  await migrate(drizzle(client), { migrationsFolder });
  return { root, client, database: drizzle({ client, schema }) };
}

test("categories are user-scoped, unique, colored, ordered, and safely deleted", async () => {
  const { root, client, database } = await createTestDatabase();
  try {
    await client.batch(
      [
        "insert into user (id, email) values ('owner', 'owner@example.test')",
        "insert into user (id, email) values ('other', 'other@example.test')",
      ],
      "write",
    );

    const health = await createBehaviorCategoryForUser(
      database,
      "owner",
      "Health",
    );
    const focus = await createBehaviorCategoryForUser(
      database,
      "owner",
      "Focus",
    );
    const rest = await createBehaviorCategoryForUser(database, "owner", "Rest");
    const other = await createBehaviorCategoryForUser(
      database,
      "other",
      "Health",
    );

    assert.deepEqual(
      [health.color, focus.color, rest.color, other.color],
      ["blue", "teal", "green", "blue"],
    );
    await assert.rejects(
      createBehaviorCategoryForUser(database, "owner", "  HEALTH  "),
    );
    assert.equal(
      await updateBehaviorCategoryForUser(database, "owner", other.id, {
        name: "Private",
        color: "purple",
      }),
      false,
    );
    await assert.rejects(
      resolveOwnedBehaviorCategoryId(database, "owner", other.id),
      /CATEGORY_NOT_FOUND/,
    );

    assert.equal(
      await updateBehaviorCategoryForUser(database, "owner", health.id, {
        name: "Wellbeing",
        color: "purple",
      }),
      true,
    );
    assert.equal(
      await moveBehaviorCategoryForUser(database, "owner", rest.id, "up"),
      true,
    );
    assert.deepEqual(
      (await listBehaviorCategoriesForUser(database, "owner")).map(
        (row) => row.name,
      ),
      ["Wellbeing", "Rest", "Focus"],
    );

    await client.execute({
      sql: `insert into behavior
        (id, user_id, category_id, name, input_type, desired_direction, created_at, updated_at)
        values ('walk', 'owner', ?, 'Walk', 'boolean', 'increase', 1, 1)`,
      args: [health.id],
    });
    assert.equal(
      await deleteBehaviorCategoryForUser(database, "owner", health.id),
      true,
    );
    const behavior = await client.execute(
      "select category_id from behavior where id = 'walk'",
    );
    assert.equal(behavior.rows[0]?.category_id, null);
    assert.equal(
      await deleteBehaviorCategoryForUser(database, "owner", other.id),
      false,
    );
  } finally {
    client.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("account export and tracking deletion include behavior categories", async () => {
  const { root, client, database } = await createTestDatabase();
  try {
    await client.execute(
      "insert into user (id, email) values ('owner', 'owner@example.test')",
    );
    const category = await createBehaviorCategoryForUser(
      database,
      "owner",
      "Health",
    );
    await client.execute({
      sql: `insert into behavior
        (id, user_id, category_id, name, input_type, desired_direction, created_at, updated_at)
        values ('walk', 'owner', ?, 'Walk', 'boolean', 'increase', 1, 1)`,
      args: [category.id],
    });

    const exported = await exportUserDataForUser(
      database,
      "owner",
      "2026-07-15T00:00:00.000Z",
    );
    assert.equal(exported.formatVersion, 3);
    assert.equal(exported.behaviorCategories[0]?.id, category.id);
    assert.equal(exported.behaviors[0]?.categoryId, category.id);

    await deleteAllTrackingDataForUser(database, "owner");
    assert.equal(
      Number(
        (
          await client.execute(
            "select count(*) as count from behavior_category",
          )
        ).rows[0]?.count,
      ),
      0,
    );
    assert.equal(
      Number(
        (await client.execute("select count(*) as count from behavior")).rows[0]
          ?.count,
      ),
      0,
    );
    assert.equal(
      Number(
        (await client.execute("select count(*) as count from user")).rows[0]
          ?.count,
      ),
      1,
    );
  } finally {
    client.close();
    await rm(root, { recursive: true, force: true });
  }
});
