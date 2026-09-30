import { getDb } from "@/db";
import { getArtwork } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: RouteContext<"/api/artworks/[id]">) {
  const { id } = await params;
  const artwork = await getArtwork(getDb(), Number(id));
  if (!artwork) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(artwork);
}
