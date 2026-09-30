import { getDb } from "@/db";
import { listArtworks } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const num = (key: string) => (params.get(key) ? Number(params.get(key)) : undefined);
  const result = await listArtworks(getDb(), {
    q: params.get("q") ?? undefined,
    century: num("century"),
    institution: params.get("institution") ?? undefined,
    withImages: params.get("images") === "1",
    page: num("page"),
    pageSize: num("pageSize"),
  });
  return Response.json(result);
}
