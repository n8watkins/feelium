import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "@/db/schema";
import { MAX_PUSH_SUBSCRIPTIONS_PER_USER } from "@/lib/push-endpoints";
import {
  claimTestPushForUser,
  findPushSubscriptionForUser,
  savePushSubscriptionForUser,
} from "@/server/data/push-subscription-operations";

async function createTestDatabase() {
  const root = await mkdtemp(join(tmpdir(), "feelium-push-"));
  const client = createClient({ url: `file:${join(root, "test.db")}` });
  await migrate(drizzle(client), { migrationsFolder: resolve("drizzle") });
  await client.batch(
    [
      "insert into user (id, email) values ('owner', 'owner@example.test')",
      "insert into user (id, email) values ('other', 'other@example.test')",
      "insert into profile (user_id, created_at, updated_at) values ('owner', 0, 0)",
      "insert into profile (user_id, created_at, updated_at) values ('other', 0, 0)",
    ],
    "write",
  );
  return { root, client, database: drizzle({ client, schema }) };
}

const keys = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQt", auth: "tBHItJI5svbpez7KI4CCXg" };
const endpoint = (n: number) => `https://fcm.googleapis.com/fcm/send/device-${n}`;

test("an account keeps at most its 10 most recently used push subscriptions", async () => {
  const { root, client, database } = await createTestDatabase();
  try {
    const start = Date.UTC(2026, 10, 3, 12);
    // The audit registered 60; only the newest 10 may survive.
    for (let n = 1; n <= 60; n++) {
      await savePushSubscriptionForUser(database, "owner", { endpoint: endpoint(n), keys }, `Device ${n}`, new Date(start + n * 1000));
    }
    await savePushSubscriptionForUser(database, "other", { endpoint: endpoint(1), keys }, "Other", new Date(start));
    const owner = await client.execute("select endpoint from push_subscription where user_id = 'owner' order by last_used_at");
    assert.equal(owner.rows.length, MAX_PUSH_SUBSCRIPTIONS_PER_USER);
    assert.deepEqual(owner.rows.map((row) => row.endpoint), Array.from({ length: 10 }, (_, i) => endpoint(51 + i)));
    // Another account's subscriptions are untouched.
    assert.equal((await client.execute("select count(*) as n from push_subscription where user_id = 'other'")).rows[0].n, 1);

    // Refreshing an old device moves it to the front instead of adding a row.
    await savePushSubscriptionForUser(database, "owner", { endpoint: endpoint(51), keys }, "Device 51", new Date(start + 100_000));
    await savePushSubscriptionForUser(database, "owner", { endpoint: endpoint(61), keys }, "Device 61", new Date(start + 101_000));
    const after = await client.execute("select endpoint from push_subscription where user_id = 'owner'");
    assert.equal(after.rows.length, 10);
    assert.ok(after.rows.some((row) => row.endpoint === endpoint(51)));
    assert.ok(!after.rows.some((row) => row.endpoint === endpoint(52)));

    assert.equal((await findPushSubscriptionForUser(database, "owner", endpoint(61)))?.endpoint, endpoint(61));
    assert.equal(await findPushSubscriptionForUser(database, "other", endpoint(61)), null);
  } finally {
    client.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("a test reminder can be sent at most once a minute per account", async () => {
  const { root, client, database } = await createTestDatabase();
  try {
    const now = new Date(Date.UTC(2026, 10, 3, 12));
    assert.equal(await claimTestPushForUser(database, "owner", now), true);
    assert.equal(await claimTestPushForUser(database, "owner", new Date(now.getTime() + 5_000)), false);
    assert.equal(await claimTestPushForUser(database, "other", new Date(now.getTime() + 5_000)), true);
    assert.equal(await claimTestPushForUser(database, "owner", new Date(now.getTime() + 60_000)), true);
  } finally {
    client.close();
    await rm(root, { recursive: true, force: true });
  }
});
