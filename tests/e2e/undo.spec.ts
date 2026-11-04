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

// A check-in of our own on a quiet past day, so other tests' data is untouched.
async function addCheckIn(userId: string, id: string, date: string) {
  const database = createClient(e2e.database);
  const [mood] = (await database.execute({ sql: "select id from outcome_metric where user_id = ? and name = 'Mood'", args: [userId] })).rows;
  const [tag] = (await database.execute({ sql: "select id from tag where user_id = ? order by name limit 1", args: [userId] })).rows;
  const at = Math.floor(Date.parse(`${date}T17:30:00Z`) / 1000);
  await database.batch(
    [
      { sql: "insert into check_in (id, user_id, occurred_at, local_date, note, created_at, updated_at) values (?, ?, ?, ?, 'Undo me', ?, ?)", args: [id, userId, at, date, at, at] },
      { sql: "insert into check_in_value (id, user_id, check_in_id, outcome_metric_id, rating_value, created_at, updated_at) values (?, ?, ?, ?, 5, ?, ?)", args: [`${id}-v`, userId, id, String(mood.id), at, at] },
      { sql: "insert into check_in_tag (check_in_id, tag_id) values (?, ?)", args: [id, String(tag.id)] },
    ],
    "write",
  );
  database.close();
}

async function rowsFor(id: string) {
  const database = createClient(e2e.database);
  const count = async (sql: string) => Number((await database.execute({ sql, args: [id] })).rows[0].n);
  const result = {
    checkIns: await count("select count(*) as n from check_in where id = ?"),
    values: await count("select count(*) as n from check_in_value where check_in_id = ?"),
    tags: await count("select count(*) as n from check_in_tag where check_in_id = ?"),
  };
  database.close();
  return result;
}

test("deleting a check-in happens at once, and Undo puts it back exactly", async ({ context, page }, testInfo) => {
  const userId = await signIn(context);
  const id = `e2e-undo-${testInfo.project.name}`;
  const date = testInfo.project.name === "desktop" ? "2026-01-20" : "2026-01-21";
  await addCheckIn(userId, id, date);

  await page.goto(`/history/${date}`);
  await expect(page.getByText("Undo me")).toBeVisible();
  await page.getByRole("button", { name: /^Delete the .* check-in$/ }).click();
  const toast = page.locator("[data-sonner-toast]").filter({ hasText: /Check-in at .* deleted/ });
  await expect(toast).toBeVisible();
  await expect(page.getByText("Undo me")).toHaveCount(0);
  expect(await rowsFor(id)).toEqual({ checkIns: 0, values: 0, tags: 0 });

  // The toast is announced politely, and its Undo is a real button the keyboard reaches.
  await expect(page.locator("[aria-live=polite]").filter({ has: toast })).toHaveCount(1);
  const undo = toast.getByRole("button", { name: "Undo" });
  await undo.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Restored" })).toBeVisible();
  await expect(page.getByText("Undo me")).toBeVisible();
  expect(await rowsFor(id)).toEqual({ checkIns: 1, values: 1, tags: 1 });

  // Without Undo the delete stands, through the toast's end and a reload.
  await page.getByRole("button", { name: /^Delete the .* check-in$/ }).click();
  await expect(toast).toBeVisible();
  await expect(toast).toHaveCount(0, { timeout: 10_000 });
  await page.reload();
  await expect(page.getByText("Undo me")).toHaveCount(0);
  expect(await rowsFor(id)).toEqual({ checkIns: 0, values: 0, tags: 0 });
});
