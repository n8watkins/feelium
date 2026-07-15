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
