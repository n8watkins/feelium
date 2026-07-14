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
      next_reminder_at integer,
      created_at integer not null,
      updated_at integer not null
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
