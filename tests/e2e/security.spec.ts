import { createClient } from "@libsql/client";
import { expect, test, type Page } from "@playwright/test";
import { encode } from "next-auth/jwt";

import { e2e } from "./env";

const SESSION_COOKIE = e2e.baseURL.startsWith("https:") ? "__Secure-authjs.session-token" : "authjs.session-token";

/** Every Content-Security-Policy violation the page reports, with what was blocked. */
async function watchViolations(page: Page) {
  const violations: string[] = [];
  await page.exposeFunction("__cspViolation", (text: string) => violations.push(text));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      (window as unknown as { __cspViolation: (text: string) => void }).__cspViolation(
        `${event.effectiveDirective} blocked ${event.blockedURI || "inline"} @ ${location.pathname} ${event.sourceFile}:${event.lineNumber}`,
      );
    });
  });
  return violations;
}

test("pages run under the CSP with no violations, in dark mode too, and send HSTS", async ({ context, page }) => {
  const database = createClient(e2e.database);
  const [user] = (await database.execute("select id, email from user where email = 'demo@example.com'")).rows;
  database.close();
  const token = await encode({
    token: { sub: String(user.id), id: String(user.id), email: String(user.email), name: "Demo" },
    secret: e2e.sessionSecret,
    salt: SESSION_COOKIE,
    maxAge: 60 * 60,
  });

  await page.emulateMedia({ colorScheme: "dark" });
  const violations = await watchViolations(page);

  const login = await page.goto("/login");
  expect(login?.headers()["strict-transport-security"]).toBe("max-age=31536000; includeSubDomains");
  // The theme script runs before paint: dark mode is on the first frame, not after hydration.
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  await context.addCookies([
    { name: SESSION_COOKIE, value: token, url: e2e.baseURL, httpOnly: true, secure: e2e.baseURL.startsWith("https:"), sameSite: "Lax" },
  ]);
  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  const notFound = await page.goto("/this-page-does-not-exist");
  expect(notFound?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  // The 404 page hydrates (its scripts carry the nonce): the theme toggle state is applied.
  await page.waitForLoadState("networkidle");

  expect(violations).toEqual([]);
});

test("GitHub is the only way to sign in", async ({ request, page }) => {
  const providers = await (await request.get("/api/auth/providers")).json();
  expect(Object.keys(providers)).toEqual(["github"]);
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Continue with GitHub" })).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByText(/password|magic link|email me/i)).toHaveCount(0);
});
