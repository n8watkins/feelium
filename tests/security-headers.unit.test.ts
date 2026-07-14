import assert from "node:assert/strict";
import test from "node:test";

import { buildContentSecurityPolicy } from "../next.config";

test("only upgrades insecure requests in production", () => {
  assert.doesNotMatch(buildContentSecurityPolicy(true), /upgrade-insecure-requests/);
  assert.match(buildContentSecurityPolicy(false), /upgrade-insecure-requests/);
});
