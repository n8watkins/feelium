import { createClient } from "@libsql/client";
import { expect, test, type BrowserContext, type Locator } from "@playwright/test";
import { encode } from "next-auth/jwt";

import { e2e } from "./env";

const SESSION_COOKIE = e2e.baseURL.startsWith("https:") ? "__Secure-authjs.session-token" : "authjs.session-token";

async function signIn(context: BrowserContext) {
  const database = createClient(e2e.database);
  const [user] = (await database.execute("select id, email from user where email = 'demo@example.com'")).rows;
  // A profile on UTC with manual timezone control, so a Los Angeles browser gets the prompt;
  // no categories, so Today has nothing to group.
  await database.execute({ sql: "update behavior set category_id = null where user_id = ?", args: [String(user.id)] });
  await database.execute({ sql: "delete from behavior_category where user_id = ?", args: [String(user.id)] });
  await database.execute({ sql: "update profile set timezone = 'UTC', auto_sync_timezone = 0 where user_id = ?", args: [String(user.id)] });
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

async function overlaps(a: Locator, b: Locator) {
  const [x, y] = [(await a.boundingBox())!, (await b.boundingBox())!];
  return x.x < y.x + y.width && y.x < x.x + x.width && x.y < y.y + y.height && y.y < x.y + x.height;
}

test("the timezone prompt sits above Today instead of covering its title and Check in", async ({ context, page }) => {
  await signIn(context);
  await page.goto("/today");
  const prompt = page.getByRole("complementary", { name: "Use this device's timezone?" });
  await expect(prompt).toBeVisible();
  const title = page.getByRole("heading", { name: "Today", exact: true, level: 1 });
  const checkIn = page.getByRole("link", { name: /Check in now/ });
  expect(await overlaps(prompt, title)).toBe(false);
  expect(await overlaps(prompt, checkIn)).toBe(false);
  // Without categories there is no visible "Uncategorized" label (it stays for screen readers).
  await expect(page.locator("h3:has-text('Uncategorized')")).toHaveClass(/\bsr-only\b/);
});

test("the latest check-in says which day it was, never '0 today'", async ({ context, page }) => {
  await signIn(context);
  await page.goto("/today");
  const latest = page.getByRole("region", { name: "Latest check-in" });
  await expect(latest).toContainText(/(Today|Yesterday|[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}), \d{1,2}:\d{2}\s?[AP]M/);
  await expect(latest).not.toContainText(/\b0 today/);
});

test("Privacy is public and linked from sign-in", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "How your data is handled" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "Privacy", level: 1 })).toBeVisible();
  await expect(page.getByText("Where your data lives")).toBeVisible();
});

test("an empty check-in explains itself next to Save, and toasts stay clear of the phone tab bar", async ({ context, page }, testInfo) => {
  await signIn(context);
  await page.goto("/checkin/new");
  await expect(page.getByText("Saved as you tap, separately from the check-in above.")).toBeVisible();
  await page.getByRole("button", { name: "Save check-in" }).click();
  const error = page.getByRole("alert").filter({ hasText: "Add at least one outcome, tag, or note." });
  await expect(error).toBeVisible();
  const save = page.getByRole("button", { name: "Save check-in" });
  const [errorBox, saveBox] = [(await error.boundingBox())!, (await save.boundingBox())!];
  expect(saveBox.y - (errorBox.y + errorBox.height)).toBeLessThan(48);

  if (testInfo.project.name !== "mobile") return;
  await page.getByRole("group", { name: "Mood" }).getByRole("button", { name: "4 out of 5" }).click();
  await save.click();
  await expect(page).toHaveURL(/\/today/);
  const toast = page.locator("[data-sonner-toast]").first();
  await expect(toast).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Primary" }).last();
  // Once its slide-in settles, the toast sits above the tab bar.
  await expect.poll(() => overlaps(toast, nav), { timeout: 3000 }).toBe(false);
});

test("an impossible History date is a real 404, and the 404 page carries the app's mark", async ({ context, page }) => {
  await signIn(context);
  const response = await page.goto("/history/2026-02-31");
  expect(response?.status()).toBe(404);
  // Inside the app the 404 keeps the app's own navigation, with no second header.
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" }).first()).toBeAttached();
  await expect(page.getByRole("banner")).toHaveCount(0);
  // Outside the app, the 404 carries the app's mark.
  const outside = await page.goto("/no-such-page");
  expect(outside?.status()).toBe(404);
  await expect(page.getByRole("banner").getByRole("link", { name: "feelium" })).toBeVisible();
});

test("reminder times name the timezone the way Settings does", async ({ context, page }) => {
  await signIn(context);
  await page.goto("/settings/notifications");
  await expect(page.getByText(/Times use UTC\./)).toBeVisible();
  await expect(page.getByText(/Times use [A-Za-z]+_/)).toHaveCount(0);
});

test("the saved confirmation shows even when Today is opened fresh", async ({ context, page }) => {
  await signIn(context);
  await page.goto("/today?checkin=saved");
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Check-in saved." })).toBeVisible();
  await expect(page).toHaveURL(/\/today$/);
});
