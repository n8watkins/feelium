import { createClient } from "@libsql/client";
import { expect, test, type Page } from "@playwright/test";
import { encode } from "next-auth/jwt";

const DATABASE_URL = "file:./.data/e2e.db";
const SESSION_COOKIE = "authjs.session-token";
const SESSION_SECRET = "feelium-e2e-secret-not-for-production";

function captureProductErrors(page: Page, errors: string[]) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (
      text.includes("Executing inline script violates") ||
      text.includes("Applying inline style violates")
    ) {
      return;
    }
    errors.push(text);
  });
}

test("preferences, categories, Today editing, and reminders work together", async ({
  browser,
  context,
  page,
}, testInfo) => {
  const database = createClient({ url: DATABASE_URL });
  const [user] = (
    await database.execute(
      "select id, email from user where email = 'demo@example.com'",
    )
  ).rows;
  expect(user?.id).toBeTruthy();
  await database.execute({
    sql: "update behavior set category_id = null where user_id = ?",
    args: [user.id],
  });
  await database.execute({
    sql: "delete from behavior_category where user_id = ?",
    args: [user.id],
  });
  await database.execute({
    sql: "delete from reminder_setting where user_id = ?",
    args: [user.id],
  });
  await database.execute({
    sql: `update profile
      set timezone = 'UTC', auto_sync_timezone = 0, week_starts_on = 1
      where user_id = ?`,
    args: [user.id],
  });

  const token = await encode({
    token: {
      sub: String(user.id),
      id: String(user.id),
      email: String(user.email),
      name: "Demo",
    },
    secret: SESSION_SECRET,
    salt: SESSION_COOKIE,
    maxAge: 60 * 60,
  });
  const sessionCookie = {
    name: SESSION_COOKIE,
    value: token,
    url: "http://127.0.0.1:3100",
    httpOnly: true,
    sameSite: "Lax" as const,
  };
  await context.addCookies([sessionCookie]);

  const errors: string[] = [];
  captureProductErrors(page, errors);

  await page.goto("/settings");
  const timezonePrompt = page.getByRole("complementary", {
    name: "Use this device's timezone?",
  });
  await expect(timezonePrompt).toBeVisible();
  await page.locator('select[name="timezone"]').selectOption("America/Los_Angeles");
  await page.locator('select[name="weekStartsOn"]').selectOption("0");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Preferences saved.")).toBeVisible();
  await expect(timezonePrompt).toBeHidden();
  await page.reload();
  await expect(page.locator('select[name="timezone"]')).toHaveValue(
    "America/Los_Angeles",
  );
  await expect(page.locator('select[name="weekStartsOn"]')).toHaveValue("0");
  await expect(timezonePrompt).toHaveCount(0);

  await page.goto("/settings/behaviors/categories");
  for (const name of ["Health", "Focus"]) {
    await page.getByLabel("New category").fill(name);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("textbox", { name: `${name} name` })).toBeVisible();
  }
  await page.getByLabel("Focus color").selectOption("purple");
  const focusForm = page
    .getByRole("textbox", { name: "Focus name" })
    .locator("xpath=ancestor::form");
  await focusForm.getByRole("button", { name: "Save", exact: true }).click();

  await page.goto("/today");
  await page.getByRole("link", { name: "Edit Exercise" }).click();
  await expect(page).toHaveURL(
    /\/settings\/behaviors\/[^?]+\?from=(?:%2F|\/)today$/,
  );
  await page.getByLabel("Category").selectOption({ label: "Health" });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(
    page.locator("section[aria-labelledby^='behavior-group-'] h3"),
  ).toHaveText(["Health", "Uncategorized"]);
  await expect(
    page
      .locator("section[aria-labelledby^='behavior-group-']")
      .filter({ hasText: "Health" })
      .getByText("Exercise", { exact: true }),
  ).toBeVisible();

  await page.goto("/settings/notifications");
  for (const time of ["08:00", "18:30"]) {
    await page.getByRole("button", { name: "Add reminder" }).click();
    await page.getByLabel("New reminder time").fill(time);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Reminder added.")).toBeVisible();
  }
  await expect(page.getByText("8:00 AM", { exact: true })).toBeVisible();
  await expect(page.getByText("6:30 PM", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /^Delete .* reminder$/ }),
  ).toHaveCount(2);

  const desktopScreenshot = testInfo.outputPath("today-desktop.png");
  await page.goto("/today");
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: desktopScreenshot,
    fullPage: true,
    caret: "initial",
  });
  await testInfo.attach("Today desktop", {
    path: desktopScreenshot,
    contentType: "image/png",
  });

  const mobileContext = await browser.newContext({
    colorScheme: "dark",
    timezoneId: "America/Los_Angeles",
    viewport: { width: 390, height: 844 },
  });
  await mobileContext.addCookies([sessionCookie]);
  const mobilePage = await mobileContext.newPage();
  captureProductErrors(mobilePage, errors);
  await mobilePage.goto("/settings/notifications");
  await expect(mobilePage.getByText("8:00 AM", { exact: true })).toBeVisible();
  await expect(mobilePage.getByText("6:30 PM", { exact: true })).toBeVisible();
  await mobilePage.waitForLoadState("networkidle");
  const mobileScreenshot = testInfo.outputPath("reminders-mobile.png");
  await mobilePage.screenshot({
    path: mobileScreenshot,
    caret: "initial",
  });
  await testInfo.attach("Reminders mobile", {
    path: mobileScreenshot,
    contentType: "image/png",
  });
  await mobileContext.close();

  const profile = await database.execute({
    sql: "select timezone, week_starts_on from profile where user_id = ?",
    args: [user.id],
  });
  const reminders = await database.execute({
    sql: "select reminder_time, timezone from reminder_setting where user_id = ? order by reminder_time",
    args: [user.id],
  });
  const assignedBehavior = await database.execute({
    sql: `select c.name as category_name
      from behavior b join behavior_category c on c.id = b.category_id
      where b.user_id = ? and b.name = 'Exercise'`,
    args: [user.id],
  });
  expect(profile.rows[0]).toEqual({
    timezone: "America/Los_Angeles",
    week_starts_on: 0,
  });
  expect(reminders.rows).toEqual([
    { reminder_time: "08:00", timezone: "America/Los_Angeles" },
    { reminder_time: "18:30", timezone: "America/Los_Angeles" },
  ]);
  expect(assignedBehavior.rows[0]?.category_name).toBe("Health");
  expect(errors).toEqual([]);
  database.close();
});
