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
}

test("a behavior tap says it saved, and says so when it didn't", async ({ context, page }) => {
  await signIn(context);
  await page.goto("/today");
  const row = page.getByRole("listitem").filter({ has: page.getByRole("group", { name: "Reading" }) });
  const yes = row.getByRole("button", { name: "Yes" });

  await yes.click();
  await expect(row.getByRole("status")).toHaveText(/Saved/);
  await expect(row).toContainText("Did it");
  await expect(row.getByRole("status")).toHaveText("", { timeout: 5000 });

  // Offline: the tap is undone and the row says it wasn't saved.
  await page.route("**/today", (route) => (route.request().method() === "POST" ? route.abort() : route.continue()));
  await yes.click();
  await expect(row.getByRole("status")).toHaveText(/Not saved/);
  await expect(row).toContainText("Did it");
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Couldn't save Reading" })).toBeVisible();

  // Back online, clear it again so other tests start from a blank day.
  await page.unroute("**/today");
  await yes.click();
  await expect(row).toContainText("Not recorded");
  await expect(row.getByRole("status")).toHaveText(/Saved/);
});

test("a check-in that isn't saved yet says so", async ({ context, page }) => {
  await signIn(context);
  await page.goto("/today");
  const checkIn = page.getByRole("region", { name: "How do you feel right now?" });
  const draft = checkIn.getByRole("status").filter({ hasText: /saved/i });
  await expect(checkIn.getByText("Not saved yet")).toHaveCount(0);
  await checkIn.getByRole("group", { name: "Energy" }).getByRole("button", { name: "3 out of 5" }).click();
  await expect(draft).toHaveText("Not saved yet");
  // Tapping again skips it, and the draft is clean once more.
  await checkIn.getByRole("group", { name: "Energy" }).getByRole("button", { name: "3 out of 5" }).click();
  await expect(checkIn.getByText("Not saved yet")).toHaveCount(0);
});
