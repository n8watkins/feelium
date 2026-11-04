import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DayGrid } from "@/app/(app)/insights/_components/day-grid";
import { FindingCard } from "@/app/(app)/insights/_components/finding-card";
import { FrequencyStrip } from "@/app/(app)/insights/_components/frequency-strip";
import { computeInsights, type InsightsInput } from "@/lib/analytics";

function sampleInsights() {
  const days = Array.from({ length: 12 }, (_, i) => `2026-07-${String(i + 1).padStart(2, "0")}`);
  const input: InsightsInput = {
    range: "30",
    today: "2026-07-14",
    behaviors: [{ id: "walk", name: "Walk", inputType: "boolean", desiredDirection: "increase", unit: null, isActive: true }],
    outcomes: [{ id: "mood", name: "Mood", inputType: "rating", desiredDirection: "higher_is_better", unit: null, isActive: true }],
    entries: days.map((entryDate, i) => ({ behaviorId: "walk", entryDate, booleanValue: i % 2 === 0, numericValue: null })),
    values: days.map((localDate, i) => ({ outcomeMetricId: "mood", localDate, occurredAt: i, rating: i % 2 === 0 ? 4 : 2, boolean: null, numeric: null })),
  };
  return computeInsights(input);
}

test("Insights charts encode values as CSP-safe SVG geometry, never inline styles", () => {
  const data = sampleInsights();
  const comparison = data.comparisons.find((c) => c.eligible)!;
  const finding = renderToStaticMarkup(createElement(FindingCard, { comparison }));
  const grid = renderToStaticMarkup(createElement(DayGrid, { stats: data.outcomes[0] }));
  const strip = renderToStaticMarkup(createElement(FrequencyStrip, { stats: data.behaviors[0] }));

  // Mood 4 on walk days sits at x = 8 + (4 - 1) / 4 * 284 = 221 on the 1 to 5 scale.
  assert.match(finding, /<circle cx="221" cy="10" r="7"/);
  // A 4 of 5 day is shaded at 0.15 + 0.85 * 0.75 = 0.7875.
  assert.match(grid, /fill-opacity="0.7875"/);
  // Thirty days in the strip, one bar each.
  assert.equal(strip.match(/<rect /g)?.length, 30);
  assert.doesNotMatch(`${finding}${grid}${strip}`, /style=/);
});

test("Sonner theme variables come from CSP-compatible application CSS", async () => {
  const [component, css] = await Promise.all([
    readFile("src/components/ui/sonner.tsx", "utf8"),
    readFile("src/app/globals.css", "utf8"),
  ]);

  assert.match(component, /className="toaster group"/);
  assert.doesNotMatch(component, /\sstyle=/);
  assert.match(css, /\.toaster\s*\{[\s\S]*?--normal-bg: var\(--popover\)/);
  assert.match(css, /--normal-text: var\(--popover-foreground\)/);
  assert.match(css, /--normal-border: var\(--border\)/);
  assert.match(css, /--border-radius: var\(--radius\)/);
});
