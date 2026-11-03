import assert from "node:assert/strict";
import { test } from "node:test";

import { appEnv, isDeployed } from "../src/lib/app-env";

test("APP_ENV names the deployment", () => {
  assert.equal(appEnv({ APP_ENV: "production" }), "production");
  assert.equal(appEnv({ APP_ENV: "preview" }), "preview");
  assert.equal(appEnv({ APP_ENV: "development" }), "development");
});

test("APP_ENV wins over the Vercel variables", () => {
  assert.equal(appEnv({ APP_ENV: "preview", VERCEL: "1", VERCEL_ENV: "production" }), "preview");
});

test("the Vercel deployment maps VERCEL_ENV until it is retired", () => {
  assert.equal(appEnv({ VERCEL: "1", VERCEL_ENV: "production" }), "production");
  assert.equal(appEnv({ VERCEL: "1", VERCEL_ENV: "preview" }), "preview");
  assert.equal(appEnv({ VERCEL: "1" }), "preview");
});

test("a local run is development and the only one allowed a SQLite file", () => {
  assert.equal(appEnv({}), "development");
  assert.equal(isDeployed({}), false);
  assert.equal(isDeployed({ APP_ENV: "preview" }), true);
  assert.equal(isDeployed({ APP_ENV: "production" }), true);
});

test("an unknown APP_ENV fails instead of silently counting as local", () => {
  assert.throws(() => appEnv({ APP_ENV: "staging" }), /APP_ENV must be one of/);
});
