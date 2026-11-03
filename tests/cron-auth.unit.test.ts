import assert from "node:assert/strict";
import test from "node:test";

import { isCronAuthorized } from "@/lib/cron-auth";

test("the reminder route accepts only the cron secret, and the URL form only off production", () => {
  const secret = "s3cret-value";
  assert.equal(isCronAuthorized(`Bearer ${secret}`, null, secret, true), true);
  assert.equal(isCronAuthorized("Bearer wrong-value!", null, secret, true), false);
  assert.equal(isCronAuthorized(`Bearer ${secret}x`, null, secret, true), false);
  assert.equal(isCronAuthorized(null, secret, secret, true), false);
  assert.equal(isCronAuthorized(null, secret, secret, false), true);
  assert.equal(isCronAuthorized(`Bearer ${secret}`, null, undefined, false), false);
  assert.equal(isCronAuthorized("Bearer ", null, "", false), false);
});
