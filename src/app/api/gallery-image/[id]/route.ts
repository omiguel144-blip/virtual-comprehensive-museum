import { getDb } from "@/db";
import { fetchApprovedImage } from "@/lib/fetch-image";
import { isAllowedImageHost } from "@/lib/image-hosts";
import { cacheKey, readCached, resizeForTexture, writeCached, type TextureSize } from "@/lib/image-cache";
import { getArtwork } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Same-origin, resized copy of an approved image for use as a WebGL texture
 * (textures need CORS, which museum image hosts don't all send). The rights
 * gate runs on every request before the cache is consulted, so blocked or
 * withdrawn images return 404 even if a cached copy exists.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/gallery-image/[id]">) {
  const { id } = await params;
  const size: TextureSize = new URL(request.url).searchParams.get("size") === "large" ? "large" : "small";
  const artwork = await getArtwork(getDb(), Number(id));
  const url = size === "large" ? artwork?.image?.imageUrl : artwork?.image?.thumbnailUrl;
  if (!url || !isAllowedImageHost(url)) return new Response("Not found", { status: 404 });

  const etag = `"${cacheKey(url, size)}"`;
  const headers = {
    "Content-Type": "image/jpeg",
    // Short cache so a takedown takes effect within an hour.
    "Cache-Control": "public, max-age=3600",
    ETag: etag,
  };
  if (request.headers.get("if-none-match") === etag && readCached(url, size)) {
    return new Response(null, { status: 304, headers });
  }

  const cached = readCached(url, size);
  if (cached) return new Response(new Uint8Array(cached), { headers });

  let result = await fetchApprovedImage(url);
  // One gentle retry for refusals that can be caused by request bursts.
  if (!result.ok && /^HTTP (403|429|503)\b/.test(result.reason)) {
    await new Promise((r) => setTimeout(r, 800));
    result = await fetchApprovedImage(url);
  }
  if (!result.ok) {
    if (result.reason === "host not allowed") return new Response("Not found", { status: 404 });
    console.warn(`[gallery-image] artwork ${id} (${size}) failed: ${result.reason} <- ${url}`);
    return new Response(`Image unavailable: ${result.reason}`, { status: 502 });
  }

  const original = Buffer.from(await new Response(result.body).arrayBuffer());
  try {
    const resized = await resizeForTexture(original, size);
    writeCached(url, size, resized);
    return new Response(new Uint8Array(resized), { headers });
  } catch (err) {
    // Unusual formats: serve the original rather than nothing.
    console.warn(`[gallery-image] artwork ${id} (${size}) could not be resized: ${(err as Error).message}`);
    return new Response(new Uint8Array(original), { headers: { ...headers, "Content-Type": result.contentType, ETag: "" } });
  }
}
