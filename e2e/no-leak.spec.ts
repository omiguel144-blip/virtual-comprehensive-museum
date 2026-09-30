import { expect, test } from "@playwright/test";
import { BLOCKED_THUMB, BLOCKED_URL, OPEN_THUMB, OPEN_URL } from "./fixture";

const leaked = (body: string) => body.includes(BLOCKED_URL) || body.includes(BLOCKED_THUMB);

test("withdrawn images never appear in HTML, JSON, or social previews", async ({ request }) => {
  for (const path of ["/", "/?images=1", "/artworks/2", "/api/artworks", "/api/artworks/2"]) {
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
