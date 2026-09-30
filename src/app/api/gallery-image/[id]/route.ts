import { getDb } from "@/db";
import { fetchApprovedImage } from "@/lib/fetch-image";
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
  if (!url) return new Response("Not found", { status: 404 });

  const result = await fetchApprovedImage(url);
  if (!result.ok) {
    if (result.reason === "host not allowed") return new Response("Not found", { status: 404 });
    console.warn(`[gallery-image] artwork ${id} (${size}) failed: ${result.reason} <- ${url}`);
    return new Response(`Image unavailable: ${result.reason}`, { status: 502 });
  }
  return new Response(result.body, {
    headers: {
      "Content-Type": result.contentType,
      // Short cache so a takedown takes effect within an hour.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
