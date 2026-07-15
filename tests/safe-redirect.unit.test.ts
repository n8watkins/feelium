import assert from "node:assert/strict";
import test from "node:test";

import { safeRedirectPath } from "@/lib/safe-redirect";

test("accepts internal return paths used by behavior editing", () => {
  assert.equal(safeRedirectPath("/today", "/settings/behaviors"), "/today");
  assert.equal(
    safeRedirectPath("/history/2026-07-14?from=edit", "/today"),
    "/history/2026-07-14?from=edit",
  );
});

test("rejects external and malformed return paths", () => {
  for (const value of [
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "today",
    "/today\nLocation: https://example.com",
  ]) {
    assert.equal(
      safeRedirectPath(value, "/settings/behaviors"),
      "/settings/behaviors",
    );
  }
});
