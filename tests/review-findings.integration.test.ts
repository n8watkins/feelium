import assert from "node:assert/strict";
import test from "node:test";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "@/db/schema";
import {
  ensureProfileForUser,
  setProfileTimeZoneForUser,
  syncProfileTimeZone,
  updateProfileAndReminderTimeZoneForUser,
  updateProfilePreferencesForUser,
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
  renewReminderDeliveryLease,
} from "@/server/data/reminder-delivery-operations";
import {
  createReminderForUser,
  deleteReminderForUser,
  listRemindersForUser,
  updateReminderForUser,
} from "@/server/data/reminder-schedule-operations";

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
      user_id text not null references user(id) on delete cascade,
      is_enabled integer not null default 0,
      reminder_time text,
      timezone text not null default 'UTC',
      last_sent_local_date text,
      delivery_local_date text,
      delivery_occurrence_at integer,
      delivery_lease_token text,
      delivery_lease_expires_at integer,
      next_reminder_at integer,
      created_at integer not null,
      updated_at integer not null,
      unique(user_id, reminder_time)
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
      reminder_failure_count integer not null default 0,
      reminder_quarantined_at integer,
      unique(user_id, endpoint)
    );
    create table reminder_delivery_attempt (
      id text primary key,
      reminder_id text not null references reminder_setting(id) on delete cascade,
      subscription_id text not null references push_subscription(id) on delete cascade,
      occurrence_at integer not null,
      local_date text not null,
      attempt_count integer not null default 0,
      last_attempt_at integer,
      delivered_at integer,
      created_at integer not null,
      updated_at integer not null,
      unique(reminder_id, subscription_id, occurrence_at)
    );
  `);
  return { client, database: drizzle({ client, schema }) };
}

async function claimTestReminder(
  client: Awaited<ReturnType<typeof createTestDatabase>>["client"],
  database: Awaited<ReturnType<typeof createTestDatabase>>["database"],
  userId: string,
): Promise<string> {
  await client.execute({
    sql: `insert into reminder_setting (
      id, user_id, is_enabled, reminder_time, timezone, next_reminder_at,
      created_at, updated_at
    ) values (?, ?, 1, '09:00', 'UTC', 1, 1, 1)`,
    args: [`reminder-${userId}`, userId],
  });
  const token = await claimReminderDeliveryLease(
    database,
    {
      id: `reminder-${userId}`,
      userId,
      reminderTime: "09:00",
      timezone: "UTC",
      nextReminderAt: new Date(1000),
      deliveryLocalDate: null,
      deliveryOccurrenceAt: null,
    },
    "2026-07-14",
    new Date(1000),
    new Date(1000),
    10_000,
  );
  assert.ok(token);
  return token;
}

test("new profiles expose explicit timezone sync state on the first request", async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.execute(
      "insert into user (id, email) values ('new-user', 'new@example.test')",
    );

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
    await client.execute(
      "insert into user (id, email) values ('race-user', 'race@example.test')",
    );
    await ensureProfileForUser(database, "race-user");
    await client.execute(`
      update profile
      set timezone = 'Europe/Paris', auto_sync_timezone = 0
      where user_id = 'race-user'
    `);

    const updated = await syncProfileTimeZone(
      database,
      "race-user",
      "America/New_York",
    );
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

test("manual preferences persist only for the selected profile", async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.execute(
      "insert into user (id, email) values ('owner', 'owner@example.test')",
    );
    await client.execute(
      "insert into user (id, email) values ('other', 'other@example.test')",
    );
    await ensureProfileForUser(database, "owner");
    await ensureProfileForUser(database, "other");

    assert.equal(
      await updateProfilePreferencesForUser(database, "owner", {
        timezone: "America/Los_Angeles",
        weekStartsOn: 0,
      }),
      true,
    );

    const result = await client.execute(
      "select user_id, timezone, week_starts_on, auto_sync_timezone from profile order by user_id",
    );
    assert.deepEqual(
      result.rows.map((row) => ({
        userId: row.user_id,
        timezone: row.timezone,
        weekStartsOn: Number(row.week_starts_on),
        autoSyncTimezone: Number(row.auto_sync_timezone),
      })),
      [
        {
          userId: "other",
          timezone: "UTC",
          weekStartsOn: 1,
          autoSyncTimezone: 1,
        },
        {
          userId: "owner",
          timezone: "America/Los_Angeles",
          weekStartsOn: 0,
          autoSyncTimezone: 0,
        },
      ],
    );
  } finally {
    client.close();
  }
});

test("an explicit device-timezone correction updates a legacy profile", async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.execute(
      "insert into user (id, email) values ('legacy', 'legacy@example.test')",
    );
    await ensureProfileForUser(database, "legacy");
    await client.execute(
      "update profile set timezone = 'UTC', auto_sync_timezone = 0 where user_id = 'legacy'",
    );

    assert.equal(
      await setProfileTimeZoneForUser(
        database,
        "legacy",
        "America/Los_Angeles",
      ),
      true,
    );
    const result = await client.execute(
      "select timezone, auto_sync_timezone from profile where user_id = 'legacy'",
    );
    assert.equal(result.rows[0]?.timezone, "America/Los_Angeles");
    assert.equal(Number(result.rows[0]?.auto_sync_timezone), 0);
  } finally {
    client.close();
  }
});

test("timezone initialization completes when the detected timezone is unchanged", async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.execute(
      "insert into user (id, email) values ('utc-user', 'utc@example.test')",
    );
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
    await client.execute(
      "insert into user (id, email) values ('lease-user', 'lease@example.test')",
    );
    await client.execute(`
      insert into reminder_setting (
        id, user_id, is_enabled, reminder_time, timezone, next_reminder_at,
        created_at, updated_at
      ) values (
        'lease-reminder', 'lease-user', 1, '09:00', 'UTC', 1, 1, 1
      )
    `);
    const reminder = {
      id: "lease-reminder",
      userId: "lease-user",
      reminderTime: "09:00",
      timezone: "UTC",
      nextReminderAt: new Date(1000),
      deliveryLocalDate: null,
      deliveryOccurrenceAt: null,
    };
    const firstToken = await claimReminderDeliveryLease(
      database,
      reminder,
      "2026-07-14",
      new Date(1000),
      new Date(1000),
      1000,
    );
    assert.ok(firstToken);
    assert.equal(
      await claimReminderDeliveryLease(
        database,
        {
          ...reminder,
          nextReminderAt: new Date(2000),
          deliveryLocalDate: "2026-07-14",
        },
        "2026-07-14",
        new Date(1000),
        new Date(1500),
        1000,
      ),
      null,
    );

    const secondToken = await claimReminderDeliveryLease(
      database,
      {
        ...reminder,
        nextReminderAt: new Date(2000),
        deliveryLocalDate: "2026-07-14",
      },
      "2026-07-14",
      new Date(1000),
      new Date(2000),
      1000,
    );
    assert.ok(secondToken);
    assert.notEqual(secondToken, firstToken);
    assert.equal(
      await completeReminderDeliveryLease(
        database,
        "lease-reminder",
        "lease-user",
        "2026-07-14",
        new Date(1000),
        firstToken,
        new Date(2000),
        new Date(10_000),
      ),
      false,
    );
    assert.equal(
      await releaseReminderDeliveryLease(
        database,
        "lease-reminder",
        "lease-user",
        "2026-07-14",
        new Date(1000),
        secondToken,
        new Date(2500),
        new Date(4000),
      ),
      true,
    );
  } finally {
    client.close();
  }
});

test("reclaimed reminder leases fence stale dispatch progress and finalization", async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.execute(
      "insert into user (id, email) values ('fenced-user', 'fenced@example.test')",
    );
    await client.execute(`
      insert into reminder_setting (
        id, user_id, is_enabled, reminder_time, timezone, next_reminder_at,
        created_at, updated_at
      ) values (
        'fenced-reminder', 'fenced-user', 1, '09:00', 'UTC', 1, 1, 1
      )
    `);
    for (const id of ["progress", "retry", "gone"]) {
      await client.execute({
        sql: `insert into push_subscription
          (id, user_id, endpoint, subscription_data, created_at)
          values (?, 'fenced-user', ?, '{}', 1)`,
        args: [id, `https://push.example/${id}`],
      });
    }
    const reminder = {
      id: "fenced-reminder",
      userId: "fenced-user",
      reminderTime: "09:00",
      timezone: "UTC",
      nextReminderAt: new Date(1000),
      deliveryLocalDate: null,
      deliveryOccurrenceAt: null,
    };
    const staleToken = await claimReminderDeliveryLease(
      database,
      reminder,
      "2026-07-14",
      new Date(1000),
      new Date(1000),
      2000,
    );
    assert.ok(staleToken);
    assert.equal(
      await renewReminderDeliveryLease(
        database,
        "fenced-reminder",
        "fenced-user",
        "2026-07-14",
        new Date(1000),
        staleToken,
        new Date(2000),
        2000,
      ),
      true,
    );
    assert.equal(
      await claimReminderDeliveryLease(
        database,
        {
          ...reminder,
          nextReminderAt: new Date(4000),
          deliveryLocalDate: "2026-07-14",
        },
        "2026-07-14",
        new Date(1000),
        new Date(3000),
        2000,
      ),
      null,
    );

    const activeToken = await claimReminderDeliveryLease(
      database,
      {
        ...reminder,
        nextReminderAt: new Date(4000),
        deliveryLocalDate: "2026-07-14",
      },
      "2026-07-14",
      new Date(1000),
      new Date(4000),
      2000,
    );
    assert.ok(activeToken);
    assert.notEqual(activeToken, staleToken);
    assert.equal(
      await renewReminderDeliveryLease(
        database,
        "fenced-reminder",
        "fenced-user",
        "2026-07-14",
        new Date(1000),
        staleToken,
        new Date(5000),
        2000,
      ),
      false,
    );
    assert.equal(
      await recordReminderSubscriptionAttempt(
        database,
        "progress",
        "fenced-reminder",
        "fenced-user",
        "2026-07-14",
        new Date(1000),
        staleToken,
        true,
        new Date(5000),
        1,
      ),
      false,
    );
    assert.equal(
      await recordReminderSubscriptionAttempt(
        database,
        "retry",
        "fenced-reminder",
        "fenced-user",
        "2026-07-14",
        new Date(1000),
        staleToken,
        false,
        new Date(5000),
        1,
      ),
      false,
    );
    assert.equal(
      await deleteReminderSubscription(
        database,
        "gone",
        "fenced-reminder",
        "fenced-user",
        "2026-07-14",
        new Date(1000),
        staleToken,
        new Date(5000),
      ),
      false,
    );
    assert.equal(
      await releaseReminderDeliveryLease(
        database,
        "fenced-reminder",
        "fenced-user",
        "2026-07-14",
        new Date(1000),
        staleToken,
        new Date(5000),
        new Date(7000),
      ),
      false,
    );
    assert.equal(
      await completeReminderDeliveryLease(
        database,
        "fenced-reminder",
        "fenced-user",
        "2026-07-14",
        new Date(1000),
        staleToken,
        new Date(5000),
        new Date(10_000),
      ),
      false,
    );

    const staleResults = await client.execute(
      `select id, last_reminder_local_date, reminder_failure_count, reminder_quarantined_at
       from push_subscription order by id`,
    );
    assert.deepEqual(
      staleResults.rows.map((row) => ({
        id: row.id,
        localDate: row.last_reminder_local_date,
        failures: Number(row.reminder_failure_count),
        quarantinedAt: row.reminder_quarantined_at,
      })),
      [
        { id: "gone", localDate: null, failures: 0, quarantinedAt: null },
        { id: "progress", localDate: null, failures: 0, quarantinedAt: null },
        { id: "retry", localDate: null, failures: 0, quarantinedAt: null },
      ],
    );
    const lease = await client.execute(
      "select delivery_lease_token from reminder_setting where user_id = 'fenced-user'",
    );
    assert.equal(lease.rows[0]?.delivery_lease_token, activeToken);
  } finally {
    client.close();
  }
});

test("partial reminder delivery retries failed devices after successes and pruning", async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.execute(
      "insert into user (id, email) values ('push-user', 'push@example.test')",
    );
    const token = await claimTestReminder(client, database, "push-user");
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
      "reminder-push-user",
      "push-user",
      "2026-07-14",
      new Date(1000),
      token,
      true,
      new Date(1000),
      3,
    );
    await deleteReminderSubscription(
      database,
      "expired",
      "reminder-push-user",
      "push-user",
      "2026-07-14",
      new Date(1000),
      token,
      new Date(1000),
    );
    await recordReminderSubscriptionAttempt(
      database,
      "transient",
      "reminder-push-user",
      "push-user",
      "2026-07-14",
      new Date(1000),
      token,
      false,
      new Date(1000),
      3,
    );

    assert.equal(
      await hasPendingReminderSubscriptions(
        database,
        "reminder-push-user",
        "push-user",
        new Date(1000),
      ),
      true,
    );
    assert.deepEqual(
      (
        await listPendingReminderSubscriptions(
          database,
          "reminder-push-user",
          "push-user",
          new Date(1000),
          25,
        )
      ).map((row) => row.id),
      ["transient"],
    );
    await recordReminderSubscriptionAttempt(
      database,
      "transient",
      "reminder-push-user",
      "push-user",
      "2026-07-14",
      new Date(1000),
      token,
      true,
      new Date(2000),
      3,
    );
    assert.equal(
      await hasPendingReminderSubscriptions(
        database,
        "reminder-push-user",
        "push-user",
        new Date(1000),
      ),
      false,
    );
    const recovered = await client.execute(
      "select reminder_failure_count, reminder_quarantined_at from push_subscription where id = 'transient'",
    );
    assert.equal(Number(recovered.rows[0]?.reminder_failure_count), 0);
    assert.equal(recovered.rows[0]?.reminder_quarantined_at, null);
  } finally {
    client.close();
  }
});

test("bounded reminder pages resume with subscriptions not yet attempted", async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.execute(
      "insert into user (id, email) values ('many-user', 'many@example.test')",
    );
    const token = await claimTestReminder(client, database, "many-user");
    for (let index = 0; index < 30; index += 1) {
      await client.execute({
        sql: `insert into push_subscription
          (id, user_id, endpoint, subscription_data, created_at)
          values (?, 'many-user', ?, '{}', 1)`,
        args: [
          `subscription-${String(index).padStart(2, "0")}`,
          `https://push.example/${index}`,
        ],
      });
    }

    const firstPage = await listPendingReminderSubscriptions(
      database,
      "reminder-many-user",
      "many-user",
      new Date(1000),
      25,
    );
    assert.equal(firstPage.length, 25);
    for (const subscription of firstPage) {
      await recordReminderSubscriptionAttempt(
        database,
        subscription.id,
        "reminder-many-user",
        "many-user",
        "2026-07-14",
        new Date(1000),
        token,
        false,
        new Date(1000),
        3,
      );
    }
    const secondPage = await listPendingReminderSubscriptions(
      database,
      "reminder-many-user",
      "many-user",
      new Date(1000),
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

test("permanently failing reminder subscriptions are quarantined after three attempts", async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.execute(
      "insert into user (id, email) values ('failed-user', 'failed@example.test')",
    );
    const token = await claimTestReminder(client, database, "failed-user");
    await client.execute(`
      insert into push_subscription
        (id, user_id, endpoint, subscription_data, created_at)
      values
        ('failed-subscription', 'failed-user', 'https://push.example/failed', '{}', 1)
    `);

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      await recordReminderSubscriptionAttempt(
        database,
        "failed-subscription",
        "reminder-failed-user",
        "failed-user",
        "2026-07-14",
        new Date(1000),
        token,
        false,
        new Date(attempt * 1000),
        3,
      );
      assert.equal(
        await hasPendingReminderSubscriptions(
          database,
          "reminder-failed-user",
          "failed-user",
          new Date(1000),
        ),
        true,
      );
    }

    await recordReminderSubscriptionAttempt(
      database,
      "failed-subscription",
      "reminder-failed-user",
      "failed-user",
      "2026-07-14",
      new Date(1000),
      token,
      false,
      new Date(3000),
      3,
    );
    assert.equal(
      await hasPendingReminderSubscriptions(
        database,
        "reminder-failed-user",
        "failed-user",
        new Date(1000),
      ),
      false,
    );
    assert.equal(
      await hasPendingReminderSubscriptions(
        database,
        "reminder-failed-user",
        "failed-user",
        new Date(86_401_000),
      ),
      false,
    );
    const result = await client.execute(
      "select reminder_failure_count, reminder_quarantined_at from push_subscription where id = 'failed-subscription'",
    );
    assert.equal(Number(result.rows[0]?.reminder_failure_count), 3);
    assert.equal(Number(result.rows[0]?.reminder_quarantined_at), 3);
  } finally {
    client.close();
  }
});

test("invalid legacy reminders leave the queue without affecting corrected schedules", async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.execute(
      "insert into user (id, email) values ('invalid-user', 'invalid@example.test')",
    );
    await client.execute(`
      insert into reminder_setting (
        id, user_id, is_enabled, reminder_time, timezone, created_at, updated_at
      ) values (
        'invalid-reminder', 'invalid-user', 1, '09:00', 'Invalid/Timezone', 1, 1
      )
    `);
    const invalidCandidate = {
      id: "invalid-reminder",
      userId: "invalid-user",
      reminderTime: "09:00",
      timezone: "Invalid/Timezone",
      nextReminderAt: null,
      deliveryLocalDate: null,
      deliveryOccurrenceAt: null,
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

test("reminder schedules are user scoped and reject duplicate local times", async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.execute(
      "insert into user (id, email) values ('owner', 'owner@example.test')",
    );
    await client.execute(
      "insert into user (id, email) values ('other', 'other@example.test')",
    );
    const morning = await createReminderForUser(database, "owner", {
      isEnabled: true,
      reminderTime: "08:00",
      timezone: "America/Los_Angeles",
    });
    const evening = await createReminderForUser(database, "owner", {
      isEnabled: false,
      reminderTime: "20:00",
      timezone: "America/Los_Angeles",
    });

    await assert.rejects(() =>
      createReminderForUser(database, "owner", {
        isEnabled: true,
        reminderTime: "08:00",
        timezone: "UTC",
      }),
    );
    assert.equal(
      await updateReminderForUser(database, "other", morning.id, {
        isEnabled: false,
        reminderTime: "09:00",
        timezone: "UTC",
      }),
      false,
    );
    assert.equal(
      await deleteReminderForUser(database, "other", evening.id),
      false,
    );
    assert.deepEqual(
      (await listRemindersForUser(database, "owner")).map(
        (row) => row.reminderTime,
      ),
      ["08:00", "20:00"],
    );
  } finally {
    client.close();
  }
});

test("two reminder occurrences on one local day deliver independently", async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.execute(
      "insert into user (id, email) values ('multi', 'multi@example.test')",
    );
    await client.execute(`
      insert into reminder_setting
        (id, user_id, is_enabled, reminder_time, timezone, next_reminder_at, created_at, updated_at)
      values
        ('morning', 'multi', 1, '08:00', 'UTC', 1, 1, 1),
        ('evening', 'multi', 1, '20:00', 'UTC', 2, 1, 1)
    `);
    await client.execute(`
      insert into push_subscription
        (id, user_id, endpoint, subscription_data, created_at)
      values ('device', 'multi', 'https://push.example/device', '{}', 1)
    `);
    const morningOccurrence = new Date(1000);
    const eveningOccurrence = new Date(2000);
    const morningToken = await claimReminderDeliveryLease(
      database,
      {
        id: "morning",
        userId: "multi",
        reminderTime: "08:00",
        timezone: "UTC",
        nextReminderAt: morningOccurrence,
        deliveryLocalDate: null,
        deliveryOccurrenceAt: null,
      },
      "2026-07-14",
      morningOccurrence,
      morningOccurrence,
      10_000,
    );
    const eveningToken = await claimReminderDeliveryLease(
      database,
      {
        id: "evening",
        userId: "multi",
        reminderTime: "20:00",
        timezone: "UTC",
        nextReminderAt: eveningOccurrence,
        deliveryLocalDate: null,
        deliveryOccurrenceAt: null,
      },
      "2026-07-14",
      eveningOccurrence,
      eveningOccurrence,
      10_000,
    );
    assert.ok(morningToken);
    assert.ok(eveningToken);

    assert.equal(
      await recordReminderSubscriptionAttempt(
        database,
        "device",
        "morning",
        "multi",
        "2026-07-14",
        morningOccurrence,
        morningToken,
        true,
        morningOccurrence,
        3,
      ),
      true,
    );
    assert.equal(
      await hasPendingReminderSubscriptions(
        database,
        "morning",
        "multi",
        morningOccurrence,
      ),
      false,
    );
    assert.deepEqual(
      (
        await listPendingReminderSubscriptions(
          database,
          "evening",
          "multi",
          eveningOccurrence,
          25,
        )
      ).map((row) => row.id),
      ["device"],
    );
  } finally {
    client.close();
  }
});

test("timezone changes atomically update the profile and every enabled reminder", async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.execute(
      "insert into user (id, email) values ('zones', 'zones@example.test')",
    );
    await ensureProfileForUser(database, "zones");
    await client.execute(`
      insert into reminder_setting
        (id, user_id, is_enabled, reminder_time, timezone, delivery_local_date,
         delivery_occurrence_at, delivery_lease_token, delivery_lease_expires_at,
         created_at, updated_at)
      values
        ('enabled-one', 'zones', 1, '08:00', 'UTC', '2026-07-14', 1, 'lease', 2, 1, 1),
        ('enabled-two', 'zones', 1, '20:00', 'UTC', '2026-07-14', 1, 'lease', 2, 1, 1),
        ('disabled', 'zones', 0, '12:00', 'UTC', null, null, null, null, 1, 1)
    `);

    assert.equal(
      await updateProfileAndReminderTimeZoneForUser(
        database,
        "zones",
        { timezone: "America/Los_Angeles", weekStartsOn: 0 },
      ),
      true,
    );
    const profile = await client.execute(
      "select timezone, week_starts_on from profile where user_id = 'zones'",
    );
    assert.equal(profile.rows[0]?.timezone, "America/Los_Angeles");
    assert.equal(Number(profile.rows[0]?.week_starts_on), 0);
    const result = await client.execute(
      `select id, timezone, next_reminder_at, delivery_local_date,
        delivery_occurrence_at, delivery_lease_token, delivery_lease_expires_at
       from reminder_setting order by id`,
    );
    assert.equal(
      result.rows.find((row) => row.id === "disabled")?.timezone,
      "UTC",
    );
    for (const id of ["enabled-one", "enabled-two"]) {
      const row = result.rows.find((candidate) => candidate.id === id);
      assert.equal(row?.timezone, "America/Los_Angeles");
      assert.notEqual(row?.next_reminder_at, null);
      assert.equal(row?.delivery_local_date, null);
      assert.equal(row?.delivery_occurrence_at, null);
      assert.equal(row?.delivery_lease_token, null);
      assert.equal(row?.delivery_lease_expires_at, null);
    }
  } finally {
    client.close();
  }
});

test("a reminder update failure rolls back the profile and every schedule", async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.execute(
      "insert into user (id, email) values ('rollback', 'rollback@example.test')",
    );
    await ensureProfileForUser(database, "rollback");
    await client.execute(`
      insert into reminder_setting
        (id, user_id, is_enabled, reminder_time, timezone, created_at, updated_at)
      values
        ('allowed', 'rollback', 1, '08:00', 'UTC', 1, 1),
        ('blocked', 'rollback', 1, '20:00', 'UTC', 1, 1)
    `);
    await client.execute(`
      create trigger reject_blocked_timezone before update on reminder_setting
      when old.id = 'blocked'
      begin
        select raise(abort, 'forced reminder failure');
      end
    `);

    await assert.rejects(
      updateProfileAndReminderTimeZoneForUser(database, "rollback", {
        timezone: "America/Los_Angeles",
      }),
      /forced reminder failure/,
    );
    const profile = await client.execute(
      "select timezone from profile where user_id = 'rollback'",
    );
    assert.equal(profile.rows[0]?.timezone, "UTC");
    const reminders = await client.execute(
      "select distinct timezone from reminder_setting where user_id = 'rollback'",
    );
    assert.deepEqual(reminders.rows.map((row) => row.timezone), ["UTC"]);
  } finally {
    client.close();
  }
});

test("timezone changes retry when a reminder changes after snapshot capture", async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.execute(
      "insert into user (id, email) values ('concurrent', 'concurrent@example.test')",
    );
    await ensureProfileForUser(database, "concurrent");
    await client.execute(`
      insert into reminder_setting
        (id, user_id, is_enabled, reminder_time, timezone, created_at, updated_at)
      values ('changing', 'concurrent', 1, '08:00', 'UTC', 1, 1)
    `);
    let batchCalls = 0;
    const racingDatabase = new Proxy(database, {
      get(target, property, receiver) {
        if (property === "batch") {
          return async (...args: Parameters<typeof database.batch>) => {
            batchCalls += 1;
            if (batchCalls === 1) {
              await client.execute(
                "update reminder_setting set reminder_time = '09:30' where id = 'changing'",
              );
            }
            return database.batch(...args);
          };
        }
        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    assert.equal(
      await updateProfileAndReminderTimeZoneForUser(
        racingDatabase,
        "concurrent",
        { timezone: "America/Los_Angeles" },
      ),
      true,
    );
    assert.equal(batchCalls, 2);
    const result = await client.execute(
      `select p.timezone as profile_timezone, r.timezone as reminder_timezone,
        r.reminder_time, r.next_reminder_at
       from profile p join reminder_setting r on r.user_id = p.user_id
       where p.user_id = 'concurrent'`,
    );
    assert.equal(result.rows[0]?.profile_timezone, "America/Los_Angeles");
    assert.equal(result.rows[0]?.reminder_timezone, "America/Los_Angeles");
    assert.equal(result.rows[0]?.reminder_time, "09:30");
    assert.notEqual(result.rows[0]?.next_reminder_at, null);
  } finally {
    client.close();
  }
});

test("automatic timezone sync cannot reschedule reminders after manual preference wins", async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.execute(
      "insert into user (id, email) values ('manual-wins', 'manual@example.test')",
    );
    await ensureProfileForUser(database, "manual-wins");
    await client.execute(`
      insert into reminder_setting
        (id, user_id, is_enabled, reminder_time, timezone, created_at, updated_at)
      values ('manual-reminder', 'manual-wins', 1, '08:00', 'UTC', 1, 1)
    `);
    let batchCalls = 0;
    const racingDatabase = new Proxy(database, {
      get(target, property, receiver) {
        if (property === "batch") {
          return async (...args: Parameters<typeof database.batch>) => {
            batchCalls += 1;
            await client.execute(`
              update profile
              set timezone = 'America/New_York', auto_sync_timezone = 0
              where user_id = 'manual-wins'
            `);
            return database.batch(...args);
          };
        }
        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    assert.equal(
      await updateProfileAndReminderTimeZoneForUser(
        racingDatabase,
        "manual-wins",
        {
          timezone: "America/Los_Angeles",
          requireAutoSync: true,
        },
      ),
      false,
    );
    assert.equal(batchCalls, 1);
    const result = await client.execute(`
      select p.timezone as profile_timezone, r.timezone as reminder_timezone
      from profile p join reminder_setting r on r.user_id = p.user_id
      where p.user_id = 'manual-wins'
    `);
    assert.equal(result.rows[0]?.profile_timezone, "America/New_York");
    assert.equal(result.rows[0]?.reminder_timezone, "UTC");
  } finally {
    client.close();
  }
});

test("subscription state remains unchanged when the lease is reclaimed after attempt recording", async () => {
  const { client, database } = await createTestDatabase();
  try {
    await client.execute(
      "insert into user (id, email) values ('reclaimed', 'reclaimed@example.test')",
    );
    const token = await claimTestReminder(client, database, "reclaimed");
    await client.execute(`
      insert into push_subscription
        (id, user_id, endpoint, subscription_data, created_at)
      values ('reclaimed-device', 'reclaimed', 'https://push.example/reclaimed', '{}', 1)
    `);
    await client.execute(`
      create trigger reclaim_after_attempt after insert on reminder_delivery_attempt
      begin
        update reminder_setting
        set delivery_lease_token = 'replacement-token'
        where id = new.reminder_id;
      end
    `);

    assert.equal(
      await recordReminderSubscriptionAttempt(
        database,
        "reclaimed-device",
        "reminder-reclaimed",
        "reclaimed",
        "2026-07-14",
        new Date(1000),
        token,
        false,
        new Date(1000),
        1,
      ),
      false,
    );
    const result = await client.execute(`
      select last_reminder_attempt_at, reminder_failure_count, reminder_quarantined_at
      from push_subscription where id = 'reclaimed-device'
    `);
    assert.equal(result.rows[0]?.last_reminder_attempt_at, null);
    assert.equal(Number(result.rows[0]?.reminder_failure_count), 0);
    assert.equal(result.rows[0]?.reminder_quarantined_at, null);
  } finally {
    client.close();
  }
});
