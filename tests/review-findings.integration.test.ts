import assert from "node:assert/strict";
import test from "node:test";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "@/db/schema";
import {
  ensureProfileForUser,
  syncProfileTimeZone,
} from "@/server/data/profile-operations";
import { disableInvalidReminderSchedule } from "@/server/data/reminder-operations";
import {
  claimReminderDeliveryLease,
  completeReminderDeliveryLease,
  deleteReminderSubscription,
  hasPendingReminderSubscriptions,
  listPendingReminderSubscriptions,
  recordReminderSubscriptionAttempt,
  releaseReminderDeliveryLease,
} from "@/server/data/reminder-delivery-operations";

async function createTestDatabase() {
  const client = createClient({ url: ":memory:" });
  await client.executeMultiple(`
    create table user (
      id text primary key,
      email text unique
    );
    create table profile (
      user_id text primary key references user(id) on delete cascade,
      display_name text,
      timezone text not null default 'UTC',
      auto_sync_timezone integer not null default 0,
      week_starts_on integer not null default 1,
      created_at integer not null,
      updated_at integer not null
    );
    create table reminder_setting (
      id text primary key,
      user_id text not null unique references user(id) on delete cascade,
      is_enabled integer not null default 0,
      reminder_time text,
      timezone text not null default 'UTC',
      last_sent_local_date text,
      delivery_local_date text,
      delivery_lease_token text,
      delivery_lease_expires_at integer,
      next_reminder_at integer,
      created_at integer not null,
      updated_at integer not null
    );
    create table push_subscription (
      id text primary key,
      user_id text not null references user(id) on delete cascade,
      endpoint text not null,
      subscription_data text not null,
      device_name text,
      created_at integer not null,
      last_used_at integer,
      last_reminder_local_date text,
      last_reminder_attempt_at integer,
      unique(user_id, endpoint)
    );
  `);
  return { client, database: drizzle({ client, schema }) };
}

test("new profiles expose explicit timezone sync state on the first request", async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.execute("insert into user (id, email) values ('new-user', 'new@example.test')");

    const profile = await ensureProfileForUser(database, "new-user");

    assert.ok(profile);
    assert.equal(profile.timezone, "UTC");
    assert.equal(profile.autoSyncTimezone, true);

    assert.equal(
      await syncProfileTimeZone(database, "new-user", "America/Los_Angeles"),
      true,
    );
    const result = await client.execute(
      "select timezone, auto_sync_timezone from profile where user_id = 'new-user'",
    );
    assert.equal(result.rows[0]?.timezone, "America/Los_Angeles");
    assert.equal(Number(result.rows[0]?.auto_sync_timezone), 0);
  } finally {
    client.close();
  }
});

test("background timezone sync cannot overwrite a manual preference", async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.execute("insert into user (id, email) values ('race-user', 'race@example.test')");
    await ensureProfileForUser(database, "race-user");
    await client.execute(`
      update profile
      set timezone = 'Europe/Paris', auto_sync_timezone = 0
      where user_id = 'race-user'
    `);

    const updated = await syncProfileTimeZone(database, "race-user", "America/New_York");
    const result = await client.execute(
      "select timezone, auto_sync_timezone from profile where user_id = 'race-user'",
    );

    assert.equal(updated, false);
    assert.equal(result.rows[0]?.timezone, "Europe/Paris");
    assert.equal(Number(result.rows[0]?.auto_sync_timezone), 0);
  } finally {
    client.close();
  }
});

test("timezone initialization completes when the detected timezone is unchanged", async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.execute("insert into user (id, email) values ('utc-user', 'utc@example.test')");
    await ensureProfileForUser(database, "utc-user");

    assert.equal(await syncProfileTimeZone(database, "utc-user", "UTC"), true);
    const result = await client.execute(
      "select timezone, auto_sync_timezone from profile where user_id = 'utc-user'",
    );
    assert.equal(result.rows[0]?.timezone, "UTC");
    assert.equal(Number(result.rows[0]?.auto_sync_timezone), 0);
  } finally {
    client.close();
  }
});

test("expired reminder leases are reclaimable and stale owners cannot complete", async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.execute("insert into user (id, email) values ('lease-user', 'lease@example.test')");
    await client.execute(`
      insert into reminder_setting (
        id, user_id, is_enabled, reminder_time, timezone, next_reminder_at,
        created_at, updated_at
      ) values (
        'lease-reminder', 'lease-user', 1, '09:00', 'UTC', 1, 1, 1
      )
    `);
    const reminder = {
      userId: "lease-user",
      reminderTime: "09:00",
      timezone: "UTC",
      nextReminderAt: new Date(1000),
      deliveryLocalDate: null,
    };
    const firstToken = await claimReminderDeliveryLease(
      database,
      reminder,
      "2026-07-14",
      new Date(1000),
      1000,
    );
    assert.ok(firstToken);
    assert.equal(
      await claimReminderDeliveryLease(
        database,
        { ...reminder, nextReminderAt: new Date(2000), deliveryLocalDate: "2026-07-14" },
        "2026-07-14",
        new Date(1500),
        1000,
      ),
      null,
    );

    const secondToken = await claimReminderDeliveryLease(
      database,
      { ...reminder, nextReminderAt: new Date(2000), deliveryLocalDate: "2026-07-14" },
      "2026-07-14",
      new Date(2000),
      1000,
    );
    assert.ok(secondToken);
    assert.notEqual(secondToken, firstToken);
    assert.equal(
      await completeReminderDeliveryLease(
        database,
        "lease-user",
        "2026-07-14",
        firstToken,
        new Date(10_000),
      ),
      false,
    );
    assert.equal(
      await releaseReminderDeliveryLease(
        database,
        "lease-user",
        "2026-07-14",
        secondToken,
        new Date(4000),
      ),
      true,
    );
  } finally {
    client.close();
  }
});

test("partial reminder delivery retries failed devices after successes and pruning", async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.execute("insert into user (id, email) values ('push-user', 'push@example.test')");
    for (const id of ["delivered", "expired", "transient"]) {
      await client.execute({
        sql: `insert into push_subscription
          (id, user_id, endpoint, subscription_data, created_at)
          values (?, 'push-user', ?, '{}', 1)`,
        args: [id, `https://push.example/${id}`],
      });
    }

    await recordReminderSubscriptionAttempt(
      database,
      "delivered",
      "push-user",
      "2026-07-14",
      true,
      new Date(1000),
    );
    await deleteReminderSubscription(database, "expired", "push-user");
    await recordReminderSubscriptionAttempt(
      database,
      "transient",
      "push-user",
      "2026-07-14",
      false,
      new Date(1000),
    );

    assert.equal(
      await hasPendingReminderSubscriptions(database, "push-user", "2026-07-14"),
      true,
    );
    assert.deepEqual(
      (await listPendingReminderSubscriptions(database, "push-user", "2026-07-14", 25)).map(
        (row) => row.id,
      ),
      ["transient"],
    );
    await recordReminderSubscriptionAttempt(
      database,
      "transient",
      "push-user",
      "2026-07-14",
      true,
      new Date(2000),
    );
    assert.equal(
      await hasPendingReminderSubscriptions(database, "push-user", "2026-07-14"),
      false,
    );
  } finally {
    client.close();
  }
});

test("bounded reminder pages resume with subscriptions not yet attempted", async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.execute("insert into user (id, email) values ('many-user', 'many@example.test')");
    for (let index = 0; index < 30; index += 1) {
      await client.execute({
        sql: `insert into push_subscription
          (id, user_id, endpoint, subscription_data, created_at)
          values (?, 'many-user', ?, '{}', 1)`,
        args: [`subscription-${String(index).padStart(2, "0")}`, `https://push.example/${index}`],
      });
    }

    const firstPage = await listPendingReminderSubscriptions(
      database,
      "many-user",
      "2026-07-14",
      25,
    );
    assert.equal(firstPage.length, 25);
    for (const subscription of firstPage) {
      await recordReminderSubscriptionAttempt(
        database,
        subscription.id,
        "many-user",
        "2026-07-14",
        false,
        new Date(1000),
      );
    }
    const secondPage = await listPendingReminderSubscriptions(
      database,
      "many-user",
      "2026-07-14",
      25,
    );
    assert.deepEqual(
      secondPage.slice(0, 5).map((row) => row.id),
      [
        "subscription-25",
        "subscription-26",
        "subscription-27",
        "subscription-28",
        "subscription-29",
      ],
    );
  } finally {
    client.close();
  }
});

test("invalid legacy reminders leave the queue without affecting corrected schedules", async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.execute("insert into user (id, email) values ('invalid-user', 'invalid@example.test')");
    await client.execute(`
      insert into reminder_setting (
        id, user_id, is_enabled, reminder_time, timezone, created_at, updated_at
      ) values (
        'invalid-reminder', 'invalid-user', 1, '09:00', 'Invalid/Timezone', 1, 1
      )
    `);
    const invalidCandidate = {
      userId: "invalid-user",
      reminderTime: "09:00",
      timezone: "Invalid/Timezone",
      nextReminderAt: null,
      deliveryLocalDate: null,
    };

    assert.equal(
      await disableInvalidReminderSchedule(database, invalidCandidate),
      true,
    );
    let result = await client.execute(
      "select is_enabled from reminder_setting where id = 'invalid-reminder'",
    );
    assert.equal(Number(result.rows[0]?.is_enabled), 0);

    await client.execute(`
      update reminder_setting
      set is_enabled = 1, timezone = 'UTC'
      where id = 'invalid-reminder'
    `);
    assert.equal(
      await disableInvalidReminderSchedule(database, invalidCandidate),
      false,
    );
    result = await client.execute(
      "select is_enabled, timezone from reminder_setting where id = 'invalid-reminder'",
    );
    assert.equal(Number(result.rows[0]?.is_enabled), 1);
    assert.equal(result.rows[0]?.timezone, "UTC");
  } finally {
    client.close();
  }
});
