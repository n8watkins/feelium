import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ProportionalBar } from "@/app/(app)/insights/_components/proportional-bar";
import { Sparkline } from "@/app/(app)/insights/_components/sparkline";

test("insights charts encode dimensions as CSP-safe SVG geometry", () => {
  const sparkline = renderToStaticMarkup(
    createElement(Sparkline, {
      buckets: [
        { label: "Earlier", value: 2 },
        { label: "Later", value: 10 },
      ],
      domainMin: 0,
      domainMax: 10,
    }),
  );
  const bar = renderToStaticMarkup(
    createElement(ProportionalBar, {
      percentage: 37,
      className: "fill-primary/70",
    }),
  );

  assert.match(sparkline, /y="80"[^>]*height="20"/);
  assert.match(sparkline, /y="0"[^>]*height="100"/);
  assert.match(bar, /width="37"[^>]*height="1"/);
  assert.doesNotMatch(`${sparkline}${bar}`, /style=/);
});

test("Sonner theme variables come from CSP-compatible application CSS", async () => {
  const [component, css] = await Promise.all([
    readFile("src/components/ui/sonner.tsx", "utf8"),
    readFile("src/app/globals.css", "utf8"),
  ]);

  assert.match(component, /className="toaster group"/);
  assert.doesNotMatch(component, /\sstyle=/);
  assert.match(css, /\.toaster\s*\{[^}]*--normal-bg: var\(--popover\)/s);
  assert.match(css, /--normal-text: var\(--popover-foreground\)/);
  assert.match(css, /--normal-border: var\(--border\)/);
  assert.match(css, /--border-radius: var\(--radius\)/);
});
