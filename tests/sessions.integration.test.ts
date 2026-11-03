import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "@/db/schema";
import { withoutOAuthTokens } from "@/lib/oauth-account";
import { bumpSessionVersionForUser, getSessionVersionForUser } from "@/server/data/session-operations";

test("signing out on every device moves only that user's session version", async () => {
  const root = await mkdtemp(join(tmpdir(), "feelium-sessions-"));
  const client = createClient({ url: `file:${join(root, "test.db")}` });
  try {
    await migrate(drizzle(client), { migrationsFolder: resolve("drizzle") });
    const database = drizzle({ client, schema });
    await client.batch(["insert into user (id, email) values ('owner', 'o@example.test')", "insert into user (id, email) values ('other', 'x@example.test')"], "write");
    // Sessions minted before this change carry no version, which reads as 0.
    assert.equal(await getSessionVersionForUser(database, "owner"), 0);
    await bumpSessionVersionForUser(database, "owner");
    await bumpSessionVersionForUser(database, "owner");
    assert.equal(await getSessionVersionForUser(database, "owner"), 2);
    assert.equal(await getSessionVersionForUser(database, "other"), 0);
    assert.equal(await getSessionVersionForUser(database, "deleted"), null);
  } finally {
    client.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("GitHub's OAuth tokens are not stored", () => {
  const stored = withoutOAuthTokens({
    userId: "owner",
    type: "oauth",
    provider: "github",
    providerAccountId: "123",
    access_token: "gho_secret",
    refresh_token: "ghr_secret",
    id_token: "id",
    token_type: "bearer",
    scope: "read:user,user:email",
    expires_at: 1,
  });
  assert.equal(stored.access_token, undefined);
  assert.equal(stored.refresh_token, undefined);
  assert.equal(stored.id_token, undefined);
  assert.equal(stored.providerAccountId, "123");
});
