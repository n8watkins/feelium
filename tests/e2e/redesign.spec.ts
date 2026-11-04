import { createClient } from "@libsql/client";
import { expect, test, type BrowserContext } from "@playwright/test";
import { encode } from "next-auth/jwt";

import { e2e } from "./env";

const SESSION_COOKIE = e2e.baseURL.startsWith("https:") ? "__Secure-authjs.session-token" : "authjs.session-token";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

async function signIn(context: BrowserContext) {
  const database = createClient(e2e.database);
  const [user] = (await database.execute("select id, email from user where email = 'demo@example.com'")).rows;
  await database.execute({ sql: "update profile set timezone = 'America/Los_Angeles', auto_sync_timezone = 0 where user_id = ?", args: [String(user.id)] });
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
}

test("three tabs: Today, Insights and Settings, with History reached from Today", async ({ context, page }, testInfo) => {
  await signIn(context);
  await page.goto("/today");
  const nav = page.getByRole("navigation", { name: "Primary" }).filter({ visible: true });
  await expect(nav.getByRole("link")).toHaveText(["Today", "Insights", "Settings"]);
  await expect(nav.getByRole("link", { name: "Today" })).toHaveAttribute("aria-current", "page");
  if (testInfo.project.name === "desktop") {
    await expect(page.getByRole("link", { name: "Check in", exact: true })).toHaveAttribute("href", "/today#checkin");
  }
  await page.getByRole("link", { name: "All days" }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(nav.getByRole("link", { name: "Today" })).toHaveAttribute("aria-current", "page");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});

test.describe("on an iPhone in Safari", () => {
  test.use({ userAgent: IPHONE_UA });

  test("Reminders show how to add feelium to the Home Screen", async ({ context, page }) => {
    await signIn(context);
    await page.goto("/settings/notifications");
    const hint = page.getByRole("region", { name: "Add feelium to your Home Screen to get reminders" });
    await expect(hint).toBeVisible();
    await expect(hint.getByRole("listitem")).toHaveCount(3);
    await expect(hint).toContainText("Add to Home Screen");
    await expect(hint).toContainText("iOS 16.4");
  });

  test("the first check-in brings a one-time nudge, gone once dismissed", async ({ context, page }) => {
    await signIn(context);
    await page.goto("/today");
    await page.getByRole("group", { name: "Mood" }).getByRole("button", { name: "4 out of 5" }).click();
    await page.getByRole("button", { name: "Save check-in" }).click();
    const nudge = page.getByRole("region", { name: "Nice first check-in. Want a nudge tomorrow?" });
    await expect(nudge).toBeVisible();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Check-in saved." })).toHaveCount(1);
    await nudge.getByRole("button", { name: "Not now" }).click();
    await expect(nudge).toHaveCount(0);
    await page.getByRole("group", { name: "Mood" }).getByRole("button", { name: "3 out of 5" }).click();
    await page.getByRole("button", { name: "Save check-in" }).click();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Check-in saved." }).first()).toBeVisible();
    await expect(nudge).toHaveCount(0);
  });

  test("an installed app shows no install hint", async ({ context, page }) => {
    await signIn(context);
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query: string) =>
        query.includes("display-mode: standalone") ? ({ ...original(query), matches: true, media: query } as MediaQueryList) : original(query);
    });
    await page.goto("/settings/notifications");
    await expect(page.getByRole("region", { name: /Home Screen/ })).toHaveCount(0);
  });
});

test("a desktop browser without an install prompt shows no install hint", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await signIn(context);
  await page.goto("/settings/notifications");
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await expect(page.getByRole("region", { name: /Home Screen/ })).toHaveCount(0);
});

test("the installed app opens on Today, standalone, with launch screens for light and dark", async ({ page, request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ id: "/today", scope: "/", start_url: "/today", display: "standalone", orientation: "portrait" });
  await page.goto("/login");
  await expect(page.locator('meta[name="mobile-web-app-capable"], meta[name="apple-mobile-web-app-capable"]').first()).toHaveAttribute("content", "yes");
  const splash = page.locator('link[rel="apple-touch-startup-image"]');
  expect(await splash.count()).toBe(12);
  for (const href of await splash.evaluateAll((links) => links.slice(0, 2).map((l) => l.getAttribute("href")!))) {
    expect((await request.get(href)).headers()["content-type"]).toBe("image/png");
  }
  await expect(page.locator('link[rel="apple-touch-startup-image"][media*="prefers-color-scheme: dark"]')).toHaveCount(6);
});

test("Insights shows what stands out, each feeling day by day, and how often each behavior happened", async ({ context, page }) => {
  await signIn(context);
  await page.goto("/insights");
  await expect(page.getByRole("heading", { name: "Insights", level: 1 })).toBeVisible();
  const ranges = page.getByRole("navigation", { name: "Time range" });
  await expect(ranges.getByRole("link", { name: "30 days" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("region", { name: "What stands out" })).toBeVisible();
  // One calendar per recorded feeling, with a text summary the chart is labeled by.
  const grids = page.getByRole("region", { name: "How you felt, day by day" }).getByRole("img");
  expect(await grids.count()).toBeGreaterThan(0);
  await expect(grids.first()).toHaveAttribute("aria-label", /for each of the last 30 days\./);
  const strips = page.getByRole("region", { name: "How often you did each" }).getByRole("img");
  expect(await strips.count()).toBeGreaterThan(0);
  await ranges.getByRole("link", { name: "7 days" }).click();
  await expect(page).toHaveURL(/range=7/);
  await expect(grids.first()).toHaveAttribute("aria-label", /for each of the last 7 days\./);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});

test("signed out, / is the landing page with the waitlist, and Sign in opens a dialog over it", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What did I do, how did I feel, and are they connected?");
  await expect(page.getByRole("link", { name: "Join the waitlist" }).first()).toHaveAttribute("href", "https://n8builds.dev/upcoming?interest=feelium#feelium");
  const signIn = page.getByRole("button", { name: "Sign in" });
  await signIn.click();
  const dialog = page.getByRole("dialog", { name: "Sign in to feelium" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Continue with GitHub" })).toBeFocused();
  await expect(dialog.locator('input[name="next"]')).toHaveValue("/today");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(signIn).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});

test("a signed-out visit to an app page opens the sign-in dialog, returning there afterwards", async ({ page }) => {
  await page.goto("/insights?range=7");
  await expect(page).toHaveURL(/\/login\?next=%2Finsights%3Frange%3D7$/);
  const dialog = page.getByRole("dialog", { name: "Sign in to feelium" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('input[name="next"]')).toHaveValue("/insights?range=7");
  // Closing it leaves you on the landing page.
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("are they connected?");
});

test("signed in, / goes straight to Today", async ({ context, page }) => {
  await signIn(context);
  await page.goto("/");
  await expect(page).toHaveURL(/\/today$/);
});

test("Settings is one list: account, what you track, reminders, theme and preferences, your data", async ({ context, page }) => {
  await signIn(context);
  await page.goto("/settings");
  for (const name of ["Account", "What you track", "Reminders", "Preferences", "Your data"]) {
    await expect(page.getByRole("region", { name })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: /^Feelings/ })).toHaveAttribute("href", "/settings/outcomes");
  await expect(page.getByRole("link", { name: /^(Reminders and devices|Set up reminders)/ })).toHaveAttribute("href", "/settings/notifications");
  const theme = page.getByRole("radiogroup", { name: "Theme" });
  await theme.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expect(theme.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
  await theme.getByRole("radio", { name: "Light" }).click();
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});
