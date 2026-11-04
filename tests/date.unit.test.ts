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

test("the latest check-in says which day it was, and today's count reads naturally", async () => {
  const { addDaysISO, checkInsTodayLabel, formatCheckInMoment, todayISO } = await import("@/lib/date");
  const zone = "America/Los_Angeles";
  const today = todayISO(zone);
  const at = new Date("2026-11-03T05:00:00Z"); // 9:00 PM the evening before, in Los Angeles
  assert.equal(formatCheckInMoment(today, at, zone), "Today, 9:00 PM");
  // The audit saw "5:00 AM · 0 today" for yesterday's check-in.
  assert.equal(formatCheckInMoment(addDaysISO(today, -1), at, zone), "Yesterday, 9:00 PM");
  assert.match(formatCheckInMoment("2026-10-30", at, zone), /^Fri, Oct 30, 9:00 PM$/);
  assert.equal(checkInsTodayLabel(0), "None yet today");
  assert.equal(checkInsTodayLabel(1), "1 check-in today");
  assert.equal(checkInsTodayLabel(3), "3 check-ins today");
});
