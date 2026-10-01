import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { listGalleries, listGalleryArtworks } from "@/lib/queries";
import { parseGalleryKey, periodLabel, regionLabel } from "@/lib/regions";
import { buildScene, museumsIn } from "../build-scene";
import { GalleryRoom } from "../gallery-room";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/gallery/[key]">): Promise<Metadata> {
  const parsed = parseGalleryKey(decodeURIComponent((await params).key));
  return parsed ? { title: `${regionLabel(parsed.region)}, ${periodLabel(parsed.region, parsed.period)}` } : {};
}

export default async function GalleryPage({ params, searchParams }: PageProps<"/gallery/[key]">) {
  const key = decodeURIComponent((await params).key);
  const parsed = parseGalleryKey(key);
  if (!parsed) notFound();
  const sp = await searchParams;
  const roomParam = Number(Array.isArray(sp.room) ? sp.room[0] : sp.room) || 1;

  const db = getDb();
  const [{ items, total, room, rooms }, galleries] = await Promise.all([
    listGalleryArtworks(db, { galleryKey: key, room: roomParam }),
    listGalleries(db),
  ]);
  if (total === 0) notFound();

  const region = regionLabel(parsed.region);
  const period = periodLabel(parsed.region, parsed.period);
  const title = `${region}: ${period}${rooms > 1 ? ` (room ${room} of ${rooms})` : ""}`;

  // Doorways: earlier rooms of this gallery or the previous period behind; later ones ahead.
  const wing = galleries.filter((g) => g.region === parsed.region);
  const index = wing.findIndex((g) => g.galleryKey === key);
  const prev = wing[index - 1];
  const next = wing[index + 1];
  const plan = { href: "/gallery", label: "Floor plan" };
  const west =
    room > 1
      ? { href: `/gallery/${key}?room=${room - 1}`, label: `${period}, room ${room - 1}` }
      : prev
        ? { href: `/gallery/${prev.galleryKey}`, label: periodLabel(prev.region, prev.period) }
        : plan;
  const east =
    room < rooms
      ? { href: `/gallery/${key}?room=${room + 1}`, label: `${period}, room ${room + 1}` }
      : next
        ? { href: `/gallery/${next.galleryKey}`, label: periodLabel(next.region, next.period) }
        : plan;

  const scene = buildScene({
    works: items,
    title,
    subtitle: region,
    region: parsed.region,
    periodStart: wing[index]?.startYear ?? Infinity,
    intro: [title, `${total} works from ${museumsIn(items)}, hung at life size and in chronological order.`],
    west,
    east,
  });

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Link href="/gallery" className="text-muted hover:text-foreground">
          ← Floor plan
        </Link>
        <span className="font-serif text-lg">{title}</span>
        <span className="ml-auto flex gap-3">
          <Link href={west.href} className="text-muted hover:text-foreground">
            ‹ {west.label}
          </Link>
          <Link href={east.href} className="text-muted hover:text-foreground">
            {east.label} ›
          </Link>
        </span>
      </nav>
      <GalleryRoom key={`${key}-${room}`} scene={scene} />
      <p className="text-xs text-muted">
        Works hang at their measured size (1 unit = 1 meter) on a 1.45 m center line, so scale is true relative to the
        room and to each other. Only works with an approved image and a measured size are hung;{" "}
        <Link href={`/?q=${encodeURIComponent(region)}`} className="underline">
          the catalog
        </Link>{" "}
        lists everything.
      </p>
    </div>
  );
}
