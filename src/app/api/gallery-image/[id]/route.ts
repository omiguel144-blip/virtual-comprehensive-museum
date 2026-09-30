import { getDb } from "@/db";
import { isAllowedImageHost } from "@/lib/image-hosts";
import { getArtwork } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Same-origin copy of an approved image for use as a WebGL texture (textures
 * need CORS, which museum image hosts don't all send). The URL comes only
 * from the rights gate, so blocked or withdrawn images return 404.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/gallery-image/[id]">) {
  const { id } = await params;
  const size = new URL(request.url).searchParams.get("size") === "large" ? "large" : "small";
  const artwork = await getArtwork(getDb(), Number(id));
  const url = size === "large" ? artwork?.image?.imageUrl : artwork?.image?.thumbnailUrl;
  if (!url || !isAllowedImageHost(url)) return new Response("Not found", { status: 404 });

  const upstream = await fetch(url, { headers: { Accept: "image/jpeg,image/*" } });
  const type = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !upstream.body || !type.startsWith("image/")) {
    return new Response("Image unavailable", { status: 502 });
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": type,
      // Short cache so a takedown takes effect within an hour.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
