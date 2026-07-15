import assert from "node:assert/strict";
import test from "node:test";

import {
  addDaysISO,
  dateISOInTimeZone,
  isValidTimeZone,
  parseISODate,
  startOfWeekISO,
} from "@/lib/date";

test("formats one instant as the correct local calendar date", () => {
  const instant = new Date("2026-07-14T06:30:00.000Z");

  assert.equal(dateISOInTimeZone(instant, "America/Los_Angeles"), "2026-07-13");
  assert.equal(dateISOInTimeZone(instant, "Asia/Tokyo"), "2026-07-14");
});

test("keeps the Pacific calendar date before UTC midnight reaches the West Coast", () => {
  const instant = new Date("2026-07-15T03:00:00.000Z");

  assert.equal(dateISOInTimeZone(instant, "UTC"), "2026-07-15");
  assert.equal(dateISOInTimeZone(instant, "America/Los_Angeles"), "2026-07-14");
});

test("adds calendar days safely across leap days and DST boundaries", () => {
  assert.equal(addDaysISO("2024-02-28", 1), "2024-02-29");
  assert.equal(addDaysISO("2026-03-08", 1), "2026-03-09");
  assert.equal(parseISODate("2026-11-01").toISOString(), "2026-11-01T12:00:00.000Z");
});

test("recognizes valid IANA timezones", () => {
  assert.equal(isValidTimeZone("America/Los_Angeles"), true);
  assert.equal(isValidTimeZone("Not/A_Timezone"), false);
});

test("finds week boundaries using the user's chosen first day", () => {
  assert.equal(startOfWeekISO("2026-07-14", 1), "2026-07-13");
  assert.equal(startOfWeekISO("2026-07-14", 0), "2026-07-12");
  assert.equal(startOfWeekISO("2026-01-01", 6), "2025-12-27");
  assert.throws(() => startOfWeekISO("2026-07-14", 7), RangeError);
});
