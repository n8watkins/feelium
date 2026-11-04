import { readFileSync } from "node:fs";

import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";
import { encode } from "next-auth/jwt";

import { e2e } from "./env";

const SESSION_COOKIE = e2e.baseURL.startsWith("https:") ? "__Secure-authjs.session-token" : "authjs.session-token";
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

test("History, Insights, Data and Privacy meet WCAG AA contrast", async ({ context, page }) => {
  const database = createClient(e2e.database);
  const [user] = (await database.execute("select id, email from user where email = 'demo@example.com'")).rows;
  database.close();
  const token = await encode({
    token: { sub: String(user.id), id: String(user.id), email: String(user.email), name: "Demo" },
    secret: e2e.sessionSecret,
    salt: SESSION_COOKIE,
    maxAge: 60 * 60,
  });
  await context.addCookies([
    { name: SESSION_COOKIE, value: token, url: e2e.baseURL, httpOnly: true, secure: e2e.baseURL.startsWith("https:"), sameSite: "Lax" },
  ]);
  for (const path of ["/history", "/insights", "/settings/outcomes", "/settings/data", "/privacy"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    // Evaluated through the DevTools protocol, so the page's CSP does not apply.
    await page.evaluate(AXE);
    const violations = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (o: unknown, c: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
      const result = await axe.run(document, { runOnly: ["color-contrast"] });
      return result.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`));
    });
    expect(violations, path).toEqual([]);
  }
});

test("the landing page and the sign-in dialog meet WCAG AA contrast", async ({ page }) => {
  for (const path of ["/", "/login"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.evaluate(AXE);
    const violations = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (o: unknown, c: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
      const result = await axe.run(document, { runOnly: ["color-contrast"] });
      return result.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")}`));
    });
    expect(violations, path).toEqual([]);
  }
});
