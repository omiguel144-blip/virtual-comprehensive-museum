import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { cacheKey, cachePath, deleteCached, readCached, resizeForTexture, writeCached } from "./image-cache";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "imgcache-"));
  process.env.IMAGE_CACHE_DIR = dir;
});
afterEach(() => {
  delete process.env.IMAGE_CACHE_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

const jpeg = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 180, g: 120, b: 60 } } }).jpeg().toBuffer();

describe("image cache", () => {
  it("keys by URL and size", () => {
    expect(cacheKey("https://a/1.jpg", "small")).not.toBe(cacheKey("https://a/1.jpg", "large"));
    expect(cacheKey("https://a/1.jpg", "small")).not.toBe(cacheKey("https://a/2.jpg", "small"));
    expect(cachePath("https://a/1.jpg", "large").startsWith(dir)).toBe(true);
  });

  it("writes, reads, and deletes every size on takedown", () => {
    writeCached("https://a/1.jpg", "small", Buffer.from("s"));
    writeCached("https://a/1.jpg", "large", Buffer.from("l"));
    expect(readCached("https://a/1.jpg", "large")?.toString()).toBe("l");
    expect(deleteCached(["https://a/1.jpg", null])).toBe(2);
    expect(readCached("https://a/1.jpg", "small")).toBeNull();
  });

  it("downscales large originals to the texture limit", async () => {
    const out = await sharp(await resizeForTexture(await jpeg(6000, 4000), "large")).metadata();
    expect([out.width, out.height]).toEqual([2048, 1365]);
    const small = await sharp(await resizeForTexture(await jpeg(3000, 6000), "small")).metadata();
    expect([small.width, small.height]).toEqual([512, 1024]);
  });

  it("lets the close-up size be raised, with its own cache entries", async () => {
    const before = cacheKey("https://a/1.jpg", "large");
    process.env.GALLERY_MAX_TEXTURE = "4096";
    try {
      expect(cacheKey("https://a/1.jpg", "large")).not.toBe(before);
      const out = await sharp(await resizeForTexture(await jpeg(6000, 4000), "large")).metadata();
      expect(out.width).toBe(4096);
    } finally {
      delete process.env.GALLERY_MAX_TEXTURE;
    }
  });

  it("never upscales small images", async () => {
    const out = await sharp(await resizeForTexture(await jpeg(400, 300), "large")).metadata();
    expect([out.width, out.height]).toEqual([400, 300]);
  });
});
