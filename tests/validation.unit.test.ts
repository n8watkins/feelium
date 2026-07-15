import assert from "node:assert/strict";
import test from "node:test";

import {
  checkInPayloadSchema,
  finiteNonNegativeNumberSchema,
  isoDateSchema,
  profilePreferencesSchema,
} from "@/lib/validation";

test("rejects impossible dates and invalid timezone preferences", () => {
  assert.equal(isoDateSchema.safeParse("2026-02-30").success, false);
  assert.equal(isoDateSchema.safeParse("2024-02-29").success, true);
  assert.equal(
    profilePreferencesSchema.safeParse({ timezone: "Mars/Olympus", weekStartsOn: 1 }).success,
    false,
  );
});

test("rejects non-finite, negative, and excessive numeric values", () => {
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -1, 1_000_000_001]) {
    assert.equal(finiteNonNegativeNumberSchema.safeParse(value).success, false);
  }
  assert.equal(finiteNonNegativeNumberSchema.safeParse(0).success, true);
});

test("allows at most one typed value for each check-in outcome", () => {
  const payload = {
    localDate: "2026-07-14",
    note: null,
    values: [
      {
        outcomeMetricId: "metric-1",
        rating: 4,
        boolean: true as boolean | null,
        numeric: null,
      },
    ],
    tagIds: [],
    newTagNames: [],
  };

  assert.equal(checkInPayloadSchema.safeParse(payload).success, false);
  payload.values[0].boolean = null;
  assert.equal(checkInPayloadSchema.safeParse(payload).success, true);
});
