import { createClient } from "@libsql/client";
import { expect, test, type BrowserContext } from "@playwright/test";
import { encode } from "next-auth/jwt";

import { e2e } from "./env";

const SESSION_COOKIE = e2e.baseURL.startsWith("https:") ? "__Secure-authjs.session-token" : "authjs.session-token";

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
  return String(user.id);
}

test("the avatar opens an account menu that works from the keyboard", async ({ context, page }) => {
  await signIn(context);
  await page.goto("/today");
  const avatar = page.getByRole("button", { name: "Account menu" });
  await expect(avatar).toHaveText("D");

  // Keyboard: Enter opens it with focus inside, arrows move, Escape closes and returns focus.
  await avatar.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: "Settings" })).toBeFocused();
  await expect(menu).toBeVisible();
  await expect(menu).toContainText("Demo");
  await expect(menu).toContainText("demo@example.com");
  await expect(menu.getByRole("menuitem")).toHaveText(["Settings", "Edit feelings", "Log out", "Log out on every device"]);
  await expect(menu.getByRole("menuitemradio")).toHaveText(["Light", "Dark", "System"]);
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "Edit feelings" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(avatar).toBeFocused();

  // A click outside closes it.
  await avatar.click();
  await expect(menu).toBeVisible();
  await page.mouse.click(5, 400);
  await expect(menu).toBeHidden();

  // Theme changes in place and the menu stays open to show it.
  await avatar.click();
  await menu.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(menu.getByRole("menuitemradio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
  await menu.getByRole("menuitemradio", { name: "System" }).click();
  await page.keyboard.press("Escape");

  // Items go where they say.
  await avatar.click();
  await menu.getByRole("menuitem", { name: "Edit feelings" }).click();
  await expect(page).toHaveURL(/\/settings\/outcomes$/);
  await expect(page.getByRole("heading", { level: 1, name: "Feelings" })).toBeVisible();
  await avatar.click();
  await menu.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
});

test("Log out in the account menu signs out", async ({ context, page }) => {
  await signIn(context);
  await page.goto("/today");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/today");
  await expect(page).toHaveURL(/\/login/);
});

test("feelings can be added, renamed, reordered, archived and deleted without losing history", async ({ context, page }) => {
  const userId = await signIn(context);
  const database = createClient(e2e.database);
  try {
    await page.goto("/today");
    await page.getByRole("link", { name: "Edit feelings" }).click();
    await expect(page).toHaveURL(/\/settings\/outcomes\?from=/);
    await expect(page.getByRole("main").getByRole("link", { name: "Today" })).toBeVisible();

    // Add one; it lands at the end of the check-in.
    await page.getByRole("link", { name: "Add a feeling" }).click();
    await page.getByLabel("Name").fill("Restless");
    await page.getByRole("radio", { name: /1-5 rating/ }).check();
    await page.getByRole("button", { name: "Add feeling" }).click();
    await expect(page).toHaveURL(/\/settings\/outcomes$/);
    const list = page.getByRole("region", { name: "On your check-in" }).getByRole("listitem");
    await expect(list.filter({ hasText: "Restless" })).toBeVisible();

    // Rename it from its menu.
    await page.getByRole("button", { name: "More for Restless" }).click();
    await page.getByRole("menuitem", { name: "Rename or edit" }).click();
    await expect(page.getByRole("heading", { name: "Edit Restless" })).toBeVisible();
    await page.getByLabel("Name").fill("Calm");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/settings\/outcomes$/);

    // Move it up one, and the check-in follows the new order.
    const before = await list.locator("a > span:first-child").allTextContents();
    await page.getByRole("button", { name: "Move Calm up" }).click();
    const expected = [...before];
    const at = expected.indexOf("Calm");
    [expected[at - 1], expected[at]] = [expected[at], expected[at - 1]];
    await expect(list.locator("a > span:first-child")).toHaveText(expected);
    await page.goto("/today");
    const checkIn = page.getByRole("region", { name: "How do you feel right now?" });
    await expect(checkIn.getByRole("group", { name: "Calm" })).toBeVisible();

    // Answer it on a past day, so there is history to keep.
    const [calm] = (await database.execute({ sql: "select id from outcome_metric where user_id = ? and name = 'Calm'", args: [userId] })).rows;
    const now = Math.floor(Date.now() / 1000);
    await database.batch(
      [
        { sql: "insert into check_in (id, user_id, occurred_at, local_date, note, created_at, updated_at) values ('e2e-calm', ?, ?, '2026-01-15', null, ?, ?)", args: [userId, now, now, now] },
        { sql: "insert into check_in_value (id, user_id, check_in_id, outcome_metric_id, rating_value, created_at, updated_at) values ('e2e-calm-value', ?, 'e2e-calm', ?, 2, ?, ?)", args: [userId, String(calm.id), now, now] },
      ],
      "write",
    );

    // Archive: off the check-in, listed as archived, and Undo brings it back.
    await page.goto("/settings/outcomes");
    await page.getByRole("button", { name: "More for Calm" }).click();
    await page.getByRole("menuitem", { name: "Archive" }).click();
    const archived = page.getByRole("region", { name: "Archived" });
    await expect(archived.getByText("Calm")).toBeVisible();
    await page.locator("[data-sonner-toast]").filter({ hasText: "Calm archived" }).getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("button", { name: "Move Calm up" })).toBeVisible();

    // Delete with its answer, then Undo: it's back, answer included.
    await page.getByRole("button", { name: "More for Calm" }).click();
    await page.getByRole("menuitem", { name: "Delete with its answer" }).click();
    const erasedToast = page.locator("[data-sonner-toast]").filter({ hasText: "Calm deleted" });
    await expect(erasedToast).toContainText("Its answer was erased too.");
    await expect(page.getByRole("button", { name: "Move Calm up" })).toHaveCount(0);
    await erasedToast.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("button", { name: "Move Calm up" })).toBeVisible();
    await expect(
      database.execute({ sql: "select rating_value from check_in_value where id = 'e2e-calm-value'", args: [] }).then((r) => r.rows[0]?.rating_value),
    ).resolves.toBe(2);

    // Delete, keeping the answer: gone from Settings and the check-in, still on the day.
    await page.getByRole("button", { name: "More for Calm" }).click();
    await page.getByRole("menuitem", { name: "Delete, keep past answers" }).click();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Calm deleted" }).last()).toContainText(
      "Your past answers stay on their days in History.",
    );
    await expect(page.getByText("Calm", { exact: true })).toHaveCount(0);
    await page.goto("/today");
    await expect(checkIn.getByRole("group", { name: "Calm" })).toHaveCount(0);
    await page.goto("/history/2026-01-15");
    const kept = page.locator("dl > div").filter({ hasText: "Calm" });
    await expect(kept).toContainText("Deleted");
    await expect(kept).toContainText("2");
  } finally {
    await database.batch(
      [
        "delete from check_in_value where id = 'e2e-calm-value'",
        "delete from check_in where id = 'e2e-calm'",
        { sql: "delete from outcome_metric where user_id = ? and name in ('Calm', 'Restless')", args: [userId] },
      ],
      "write",
    );
    database.close();
  }
});
