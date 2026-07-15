import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateReminder,
  nextReminderAt,
  reminderOccurrence,
} from "@/lib/reminders";

test("calculates the next reminder in the user's timezone", () => {
  assert.equal(
    nextReminderAt(
      "20:00",
      "America/Los_Angeles",
      new Date("2026-07-14T02:00:00.000Z"),
    ).toISOString(),
    "2026-07-14T03:00:00.000Z",
  );
  assert.equal(
    nextReminderAt(
      "20:00",
      "America/Los_Angeles",
      new Date("2026-07-14T03:05:00.000Z"),
    ).toISOString(),
    "2026-07-15T03:00:00.000Z",
  );
});

test("uses the first repeated wall-clock time when daylight saving ends", () => {
  assert.equal(
    reminderOccurrence("2026-11-01", "01:30", "America/Los_Angeles").toISOString(),
    "2026-11-01T08:30:00.000Z",
  );
});

test("uses the first valid wall-clock time after a daylight-saving gap", () => {
  assert.equal(
    reminderOccurrence("2026-03-08", "02:30", "America/Los_Angeles").toISOString(),
    "2026-03-08T10:00:00.000Z",
  );
});

test("delivers a skipped spring-forward wall time at its resolved occurrence", () => {
  const evaluation = evaluateReminder(
    "02:30",
    "America/Los_Angeles",
    new Date("2026-03-08T10:00:00.000Z"),
    10,
  );

  assert.equal(evaluation.due, true);
  assert.equal(evaluation.localDate, "2026-03-08");
  assert.equal(evaluation.nextAt.toISOString(), "2026-03-09T09:30:00.000Z");
});
