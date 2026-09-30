import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db";
import { layoutRoom } from "@/lib/gallery-layout";
import { listGalleryArtworks, listInstitutions } from "@/lib/queries";
import { GalleryRoom } from "./gallery-room";
import type { GalleryPainting } from "./types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gallery" };

const CENTURIES = [14, 15, 16, 17, 18, 19, 20];

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default async function GalleryPage({ searchParams }: PageProps<"/gallery">) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const century = Number(one(params.century)) || 17;
  const institution = one(params.institution) || undefined;

  const db = getDb();
  const [works, institutions] = await Promise.all([
    listGalleryArtworks(db, { century, institution, limit: 12 }),
    listInstitutions(db),
  ]);
  const room = layoutRoom(works.map((w) => ({ id: w.id, heightCm: w.heightCm, widthCm: w.widthCm })));
  const byId = new Map(works.map((w) => [w.id, w]));
  const paintings: GalleryPainting[] = room.placements.map((placement) => {
    const w = byId.get(placement.id)!;
    return {
      ...placement,
      title: w.title,
      artist: w.artistName,
      date: w.dateDisplay,
      institution: w.institution,
      heightCm: w.heightCm,
      widthCm: w.widthCm,
      dimensionSource: w.dimensionSource,
      pixelWidth: w.image.pixelWidth,
      pixelHeight: w.image.pixelHeight,
      rightsStatement: w.image.rightsStatement,
      attributionText: w.image.attributionText,
      sourceRecordUrl: w.sourceRecordUrl,
      thumbnailUrl: w.image.thumbnailUrl,
      imageUrl: w.image.imageUrl,
    };
  });

  const href = (c: number, inst?: string) => {
    const q = new URLSearchParams({ century: String(c) });
    if (inst) q.set("institution", inst);
    return `/gallery?${q}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Room:</span>
        {CENTURIES.map((c) => (
          <Link
            key={c}
            href={href(c, institution)}
            className={`rounded border px-2 py-1 ${c === century ? "border-foreground" : "border-border text-muted hover:text-foreground"}`}
          >
            {ordinal(c)} c.
          </Link>
        ))}
        {institutions.length > 1 && (
          <span className="ml-auto flex flex-wrap gap-2">
            <Link href={href(century)} className={institution ? "text-muted hover:text-foreground" : "underline"}>
              All museums
            </Link>
            {institutions.map((name) => (
              <Link
                key={name}
                href={href(century, name)}
                className={institution === name ? "underline" : "text-muted hover:text-foreground"}
              >
                {name.replace(/^The /, "")}
              </Link>
            ))}
          </span>
        )}
      </div>

      {paintings.length === 0 ? (
        <p className="py-16 text-center text-muted">
          No paintings with approved images and measured sizes for this room yet. Try another century, or run the
          importers.
        </p>
      ) : (
        <GalleryRoom key={`${century}-${institution ?? "all"}`} paintings={paintings} length={room.length} width={room.width} height={room.height} />
      )}

      <p className="text-xs text-muted">
        Paintings are hung at their measured size (1 unit = 1 meter), so their scale is true relative to the room and
        to each other. On a screen, the actual size you see depends on your distance, not on centimeters on your
        monitor. Only works with a measured painted-surface size and an approved image are hung here;{" "}
        <Link href={`/?century=${century}`} className="underline">
          the catalog
        </Link>{" "}
        lists everything.
      </p>
    </div>
  );
}
