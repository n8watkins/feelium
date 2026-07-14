import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const migrationsFolder = resolve("drizzle");

async function legacyMigrationsFolder(root: string): Promise<string> {
  const folder = join(root, "legacy-migrations");
  const metadataFolder = join(folder, "meta");
  await mkdir(metadataFolder, { recursive: true });

  const journal = JSON.parse(
    await readFile(join(migrationsFolder, "meta", "_journal.json"), "utf8"),
  ) as { entries: Array<{ idx: number; tag: string }> };
  const initialEntry = journal.entries.find((entry) => entry.idx === 0);
  assert.ok(initialEntry, "the initial migration must remain in the journal");

  await writeFile(
    join(folder, `${initialEntry.tag}.sql`),
    await readFile(join(migrationsFolder, `${initialEntry.tag}.sql`)),
  );
  await writeFile(
    join(metadataFolder, "_journal.json"),
    JSON.stringify({ ...journal, entries: [initialEntry] }),
  );
  return folder;
}

test("migrations create a fresh database", async () => {
  const root = await mkdtemp(join(tmpdir(), "feelium-migrations-fresh-"));
  const client = createClient({ url: `file:${join(root, "fresh.db")}` });

  try {
    await migrate(drizzle(client), { migrationsFolder });
    const result = await client.execute("pragma foreign_key_check");
    assert.equal(result.rows.length, 0);

    const columns = await client.execute("pragma table_info(reminder_setting)");
    const names = columns.rows.map((row) => row.name);
    assert.ok(names.includes("last_sent_local_date"));
    assert.ok(names.includes("next_reminder_at"));

    const profileColumns = await client.execute("pragma table_info(profile)");
    assert.ok(profileColumns.rows.map((row) => row.name).includes("auto_sync_timezone"));
  } finally {
    client.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("migrations preserve legacy rows that exceed current application limits", async () => {
  const root = await mkdtemp(join(tmpdir(), "feelium-migrations-upgrade-"));
  const client = createClient({ url: `file:${join(root, "upgrade.db")}` });

  try {
    await migrate(drizzle(client), {
      migrationsFolder: await legacyMigrationsFolder(root),
    });
    await client.batch(
      [
        "insert into user (id, email) values ('legacy-user', 'legacy@example.test')",
        `insert into profile
          (user_id, timezone, week_starts_on, created_at, updated_at)
          values ('legacy-user', 'America/New_York', 0, 1, 2)`,
        `insert into behavior
          (id, user_id, name, input_type, desired_direction, created_at, updated_at)
          values ('legacy-behavior', 'legacy-user', '${"x".repeat(101)}', 'numeric', 'neutral', 1, 1)`,
        `insert into daily_behavior_entry
          (id, user_id, behavior_id, entry_date, numeric_value, created_at, updated_at)
          values ('legacy-entry', 'legacy-user', 'legacy-behavior', '2026-02-30', -1, 1, 1)`,
      ],
      "write",
    );

    await migrate(drizzle(client), { migrationsFolder });

    const behavior = await client.execute(
      "select length(name) as name_length from behavior where id = 'legacy-behavior'",
    );
    assert.equal(Number(behavior.rows[0]?.name_length), 101);
    const entry = await client.execute(
      "select entry_date, numeric_value from daily_behavior_entry where id = 'legacy-entry'",
    );
    assert.equal(entry.rows[0]?.entry_date, "2026-02-30");
    assert.equal(Number(entry.rows[0]?.numeric_value), -1);
    const profileDefault = await client.execute(
      "select auto_sync_timezone from profile where user_id = 'legacy-user'",
    );
    assert.equal(Number(profileDefault.rows[0]?.auto_sync_timezone), 0);
    assert.equal((await client.execute("pragma foreign_key_check")).rows.length, 0);
  } finally {
    client.close();
    await rm(root, { recursive: true, force: true });
  }
});
