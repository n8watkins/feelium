import { createClient, type Client } from "@libsql/client";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { encode } from "next-auth/jwt";

const BASE_URL = "http://127.0.0.1:3100";
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

async function resetUserState(database: Client, userId: string) {
  await database.execute({
    sql: "update behavior set category_id = null where user_id = ?",
    args: [userId],
  });
  await database.execute({
    sql: "delete from behavior_category where user_id = ?",
    args: [userId],
  });
  await database.execute({
    sql: "delete from reminder_setting where user_id = ?",
    args: [userId],
  });
  await database.execute({
    sql: `update profile
      set timezone = 'UTC', auto_sync_timezone = 0, week_starts_on = 1
      where user_id = ?`,
    args: [userId],
  });
}

async function exerciseCoreFlows(
  page: Page,
  platform: "desktop" | "mobile",
  testInfo: TestInfo,
) {
  await page.goto("/settings");
  const timezonePrompt = page.getByRole("complementary", {
    name: "Use this device's timezone?",
  });
  await expect(timezonePrompt).toBeVisible();
  await timezonePrompt
    .getByRole("button", { name: "Use America/Los Angeles" })
    .click();
  await expect(timezonePrompt).toBeHidden();
  await expect(page.locator('select[name="timezone"]')).toHaveValue(
    "America/Los_Angeles",
  );
  await page.locator('select[name="weekStartsOn"]').selectOption("0");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Preferences saved.")).toBeVisible();
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

  await page.waitForLoadState("networkidle");
  const todayScreenshot = testInfo.outputPath(`today-${platform}.png`);
  await page.screenshot({
    path: todayScreenshot,
    fullPage: true,
    caret: "initial",
  });
  await testInfo.attach(`Today ${platform}`, {
    path: todayScreenshot,
    contentType: "image/png",
  });

  await page.goto("/settings/notifications");
  for (const [time, label] of [
    ["08:00", "8:00 AM"],
    ["18:30", "6:30 PM"],
  ] as const) {
    await page.getByRole("button", { name: "Add reminder" }).click();
    await page.getByLabel("New reminder time").fill(time);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(
    page.getByRole("button", { name: /^Delete .* reminder$/ }),
  ).toHaveCount(2);
  await page.reload();
  await expect(page.getByText("8:00 AM", { exact: true })).toBeVisible();
  await expect(page.getByText("6:30 PM", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Delete .* reminder$/ }),
  ).toHaveCount(2);
}

function platformFor(testInfo: TestInfo): "desktop" | "mobile" {
  if (testInfo.project.name === "desktop" || testInfo.project.name === "mobile") {
    return testInfo.project.name;
  }
  throw new Error(`Unsupported Playwright project: ${testInfo.project.name}`);
}

test("preferences, categories, Today editing, and reminders work together", async ({
  context,
  page,
}, testInfo) => {
  const platform = platformFor(testInfo);
  const database = createClient({ url: DATABASE_URL });
  const [user] = (
    await database.execute(
      "select id, email from user where email = 'demo@example.com'",
    )
  ).rows;
  expect(user?.id).toBeTruthy();
  const userId = String(user.id);
  await resetUserState(database, userId);

  const token = await encode({
    token: {
      sub: userId,
      id: userId,
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
    url: BASE_URL,
    httpOnly: true,
    sameSite: "Lax" as const,
  };
  await context.addCookies([sessionCookie]);

  const errors: string[] = [];
  captureProductErrors(page, errors);

  await exerciseCoreFlows(page, platform, testInfo);

  const profile = await database.execute({
    sql: "select timezone, week_starts_on from profile where user_id = ?",
    args: [userId],
  });
  const reminders = await database.execute({
    sql: "select reminder_time, timezone from reminder_setting where user_id = ? order by reminder_time",
    args: [userId],
  });
  const assignedBehavior = await database.execute({
    sql: `select c.name as category_name
      from behavior b join behavior_category c on c.id = b.category_id
      where b.user_id = ? and b.name = 'Exercise'`,
    args: [userId],
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
