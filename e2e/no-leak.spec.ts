import { expect, test } from "@playwright/test";
import { BLOCKED_THUMB, BLOCKED_URL, OPEN_THUMB, OPEN_URL } from "./fixture";

const leaked = (body: string) => body.includes(BLOCKED_URL) || body.includes(BLOCKED_THUMB);

test("withdrawn images never appear in HTML, JSON, or social previews", async ({ request }) => {
  for (const path of ["/", "/?images=1", "/?q=portrait", "/artworks/2", "/api/artworks", "/api/artworks/2", "/gallery", "/gallery/search?q=test+painter"]) {
    const res = await request.get(path);
    expect(res.ok(), path).toBe(true);
    expect(leaked(await res.text()), path).toBe(false);
  }
});

test("approved images are shown with their source", async ({ page }) => {
  await page.goto("/artworks/1");
  await expect(page.locator(`img[src="${OPEN_URL}"]`)).toHaveCount(1);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", OPEN_THUMB);
});

test("withdrawn artwork stays in the catalog as a record", async ({ page }) => {
  await page.goto("/artworks/2");
  await expect(page.getByRole("heading", { name: "Withdrawn Portrait" })).toBeVisible();
  await expect(page.getByText("Image not shown")).toBeVisible();
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
});

test("the gallery hangs only approved works and refuses withdrawn textures", async ({ page, request }) => {
  const plan = await (await request.get("/gallery")).text();
  const href = plan.match(/href="(\/gallery\/[a-z-]+:[a-z0-9-]+)"/)?.[1];
  expect(href).toBeTruthy();
  const room = await (await request.get(href!)).text();
  expect(room).toContain("Open Landscape");
  expect(room).not.toContain("Withdrawn Portrait");
  expect(leaked(room)).toBe(false);

  const search = await (await request.get("/gallery/search?q=test+painter")).text();
  expect(search).toContain("Open Landscape");
  expect(search).not.toContain("Withdrawn Portrait");

  // Withdrawn: refused even though the fixture left cached copies on disk.
  expect((await request.get("/api/gallery-image/2")).status()).toBe(404);
  expect((await request.get("/api/gallery-image/2?size=large")).status()).toBe(404);
  // Approved, but its fixture URL is not a museum image host, so it is refused too.
  expect((await request.get("/api/gallery-image/1")).status()).toBe(404);

  await page.goto(href!);
  await expect(page.locator("canvas")).toHaveCount(1);
});

test("search matches every word and finds works by artist", async ({ request }) => {
  const hit = await (await request.get("/?q=test+painter+landscape")).text();
  expect(hit).toContain("Open Landscape");
  expect(hit).not.toContain("Withdrawn Portrait");
  const miss = await (await request.get("/?q=landscape+nonexistentword")).text();
  expect(miss).not.toContain("Open Landscape");
});

test("the header's Gallery link opens the floor plan", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Gallery", exact: true }).click();
  await expect(page).toHaveURL(/\/gallery$/);
  await expect(page.getByRole("heading", { name: "Galleries" })).toBeVisible();
});
