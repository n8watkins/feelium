import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// JSONC: drop whole-line comments, then parse.
const config = JSON.parse(
  readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, ""),
);
const example = readFileSync(new URL("../.dev.vars.example", import.meta.url), "utf8");

test("the Worker is the production deployment and has no preview URLs sharing its secrets", () => {
  assert.equal(config.vars.APP_ENV, "production");
  assert.equal(config.preview_urls, false);
});

test("reminders run every five minutes", () => {
  assert.deepEqual(config.triggers.crons, ["2-57/5 * * * *"]);
});

test("secrets stay out of the plain variables and are listed in .dev.vars.example", () => {
  for (const name of ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "AUTH_SECRET", "AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "CRON_SECRET"]) {
    assert.equal(name in config.vars, false, name);
    assert.match(example, new RegExp(`^${name}=$`, "m"));
  }
});
