import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Local cache of resized gallery textures. Museum originals can be 5–8 MB and
 * 5,000+ px; a texture never needs more than MAX_EDGE. Only images that have
 * passed the rights gate are ever written here, and a takedown deletes them.
 */

export type TextureSize = "small" | "large";
/** Close-up size can be raised for sharper detail (e.g. GALLERY_MAX_TEXTURE=4096), at the cost of speed and memory. */
const largeEdge = () => Math.min(8192, Math.max(1024, Number(process.env.GALLERY_MAX_TEXTURE) || 2048));
export const MAX_EDGE: Record<TextureSize, number> = {
  small: 1024,
  get large() {
    return largeEdge();
  },
};

export function cacheDir(): string {
  return process.env.IMAGE_CACHE_DIR ?? path.join(process.cwd(), "data", "image-cache");
}

export function cacheKey(url: string, size: TextureSize): string {
  // The edge length is part of the key, so changing the setting never serves stale sizes.
  return `${crypto.createHash("sha1").update(url).digest("hex")}-${size}-${MAX_EDGE[size]}.jpg`;
}

export const cachePath = (url: string, size: TextureSize) => path.join(cacheDir(), cacheKey(url, size));

export function readCached(url: string, size: TextureSize): Buffer | null {
  try {
    return fs.readFileSync(cachePath(url, size));
  } catch {
    return null;
  }
}

export function writeCached(url: string, size: TextureSize, data: Buffer) {
  fs.mkdirSync(cacheDir(), { recursive: true });
  const file = cachePath(url, size);
  fs.writeFileSync(`${file}.part`, data);
  fs.renameSync(`${file}.part`, file);
}

/** Deletes every cached size of the given image URLs (used by takedowns). */
export function deleteCached(urls: Array<string | null | undefined>): number {
  let removed = 0;
  for (const url of urls) {
    if (!url) continue;
    for (const size of ["small", "large"] as const) {
      try {
        fs.unlinkSync(cachePath(url, size));
        removed++;
      } catch {
        // not cached
      }
    }
  }
  return removed;
}

/** Downscales to fit MAX_EDGE (never upscales) and re-encodes as JPEG. */
export async function resizeForTexture(input: Buffer, size: TextureSize): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width: MAX_EDGE[size], height: MAX_EDGE[size], fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}
