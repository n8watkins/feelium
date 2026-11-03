import { expect, test } from "@playwright/test";

test("the Three-tone logo is the favicon, the Apple icon and every manifest icon", async ({
  page,
  request,
}) => {
  await page.goto("/login");
  const svgIcon = page.locator('link[rel="icon"][type="image/svg+xml"]');
  await expect(svgIcon).toHaveCount(1);
  const svgHref = await svgIcon.getAttribute("href");
  const svg = await request.get(svgHref!);
  expect(svg.ok()).toBe(true);
  const markup = await svg.text();
  expect(markup).toContain("#A3A3A3");
  expect(markup).not.toMatch(/#14B8A6/i);
  expect(markup).toContain("prefers-color-scheme: dark");

  await expect(page.locator('link[rel="icon"][href^="/favicon.ico"]')).toHaveCount(1);
  const apple = page.locator('link[rel="apple-touch-icon"]');
  await expect(apple).toHaveCount(1);
  expect((await request.get((await apple.getAttribute("href"))!)).ok()).toBe(true);

  // The inline mark on the login page uses the theme tokens.
  await expect(page.locator('main svg circle[fill="var(--logo-right)"]')).toHaveCount(1);

  const manifest = await (await request.get("/manifest.webmanifest")).json();
  const icons = manifest.icons as { src: string; sizes: string; purpose: string }[];
  expect(icons.map((icon) => `${icon.sizes} ${icon.purpose}`)).toEqual([
    "192x192 any",
    "512x512 any",
    "192x192 maskable",
    "512x512 maskable",
  ]);
  for (const icon of icons) {
    const response = await request.get(icon.src);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
});
