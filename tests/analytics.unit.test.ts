import assert from "node:assert/strict";
import test from "node:test";

import { computeInsights, type InsightsInput } from "@/lib/analytics";

test("keeps unknown values out of statistics and comparisons", () => {
  const days = Array.from(
    { length: 10 },
    (_, index) => `2026-07-${String(index + 1).padStart(2, "0")}`,
  );
  const input: InsightsInput = {
    range: "30",
    today: "2026-07-14",
    behaviors: [
      {
        id: "walk",
        name: "Walk",
        inputType: "boolean",
        desiredDirection: "increase",
        unit: null,
        isActive: true,
      },
    ],
    outcomes: [
      {
        id: "mood",
        name: "Mood",
        inputType: "rating",
        desiredDirection: "higher_is_better",
        unit: null,
        isActive: true,
      },
    ],
    entries: [
      ...days.map((entryDate, index) => ({
        behaviorId: "walk",
        entryDate,
        booleanValue: index < 5,
        numericValue: null,
      })),
      {
        behaviorId: "walk",
        entryDate: "2026-07-11",
        booleanValue: null,
        numericValue: null,
      },
    ],
    values: [
      ...days.map((localDate, index) => ({
        outcomeMetricId: "mood",
        localDate,
        occurredAt: index,
        rating: index < 5 ? 4 : 2,
        boolean: null,
        numeric: null,
      })),
      {
        outcomeMetricId: "mood",
        localDate: "2026-07-12",
        occurredAt: 12,
        rating: null,
        boolean: null,
        numeric: null,
      },
    ],
  };

  const insights = computeInsights(input);
  const behavior = insights.behaviors[0];
  const comparison = insights.comparisons[0];

  assert.equal(behavior?.kind, "boolean");
  if (behavior?.kind === "boolean") {
    assert.equal(behavior.recordedDays, 10);
    assert.equal(behavior.yesDays, 5);
    assert.equal(behavior.noDays, 5);
    assert.equal(behavior.unrecordedDays, 20);
  }
  assert.equal(comparison?.eligible, true);
  assert.equal(comparison?.groupA.days, 5);
  assert.equal(comparison?.groupB.days, 5);
  assert.equal(comparison?.difference, 2);
});

test("day-by-day strips cover the window ending today, with gaps as null, capped at 91 days", () => {
  const base: InsightsInput = {
    range: "7",
    today: "2026-07-14",
    behaviors: [
      { id: "walk", name: "Walk", inputType: "boolean", desiredDirection: "increase", unit: null, isActive: true },
      { id: "coffee", name: "Coffee", inputType: "numeric", desiredDirection: "neutral", unit: "cups", isActive: true },
    ],
    outcomes: [
      { id: "mood", name: "Mood", inputType: "rating", desiredDirection: "higher_is_better", unit: null, isActive: true },
    ],
    entries: [
      { behaviorId: "walk", entryDate: "2026-07-14", booleanValue: true, numericValue: null },
      { behaviorId: "walk", entryDate: "2026-07-10", booleanValue: false, numericValue: null },
      { behaviorId: "coffee", entryDate: "2026-07-13", booleanValue: null, numericValue: 0 },
      // Outside the 7-day window.
      { behaviorId: "walk", entryDate: "2026-07-01", booleanValue: true, numericValue: null },
    ],
    values: [
      { outcomeMetricId: "mood", localDate: "2026-07-14", occurredAt: 2, rating: 4, boolean: null, numeric: null },
      { outcomeMetricId: "mood", localDate: "2026-07-14", occurredAt: 3, rating: 2, boolean: null, numeric: null },
      { outcomeMetricId: "mood", localDate: "2026-07-09", occurredAt: 1, rating: 5, boolean: null, numeric: null },
    ],
  };
  const data = computeInsights(base);
  const walk = data.behaviors.find((b) => b.behavior.id === "walk")!;
  assert.deepEqual(walk.days.map((d) => d.date), [
    "2026-07-08", "2026-07-09", "2026-07-10", "2026-07-11", "2026-07-12", "2026-07-13", "2026-07-14",
  ]);
  assert.deepEqual(walk.days.map((d) => d.value), [null, null, false, null, null, null, true]);
  // A recorded zero stays a zero, not a gap.
  const coffee = data.behaviors.find((b) => b.behavior.id === "coffee")!;
  assert.equal(coffee.days.find((d) => d.date === "2026-07-13")?.value, 0);
  // Several check-ins in a day average; days without one are null.
  const mood = data.outcomes.find((o) => o.outcome.id === "mood")!;
  assert.deepEqual(mood.days.map((d) => d.value), [null, 5, null, null, null, null, 3]);

  const all = computeInsights({ ...base, range: "all", today: "2026-12-31" });
  assert.equal(all.behaviors[0].days.length, 91);
  assert.equal(all.behaviors[0].days.at(-1)?.date, "2026-12-31");
});
