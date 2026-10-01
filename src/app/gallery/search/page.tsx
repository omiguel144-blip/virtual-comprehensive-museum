import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db";
import { listGalleryArtworks } from "@/lib/queries";
import { buildScene, museumsIn } from "../build-scene";
import { GalleryRoom } from "../gallery-room";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your room" };

/** "Hang these results": a temporary room built from a search. */
export default async function SearchRoomPage({ searchParams }: PageProps<"/gallery/search">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(sp.q).trim();
  const { items, total, room, rooms } = await listGalleryArtworks(getDb(), { q, room: Number(one(sp.room)) || 1 });

  if (!q || total === 0) {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-muted">
          {q ? <>No works matching &ldquo;{q}&rdquo; can be hung yet (they need an approved image and a measured size).</> : "Search for something to hang."}
        </p>
        <p>
          <Link href={q ? `/?q=${encodeURIComponent(q)}` : "/"} className="underline">
            See {q ? "all matches" : "the catalog"}
          </Link>
          {" · "}
          <Link href="/gallery" className="underline">
            Floor plan
          </Link>
        </p>
      </div>
    );
  }

  const title = `“${q}”${rooms > 1 ? ` (room ${room} of ${rooms})` : ""}`;
  const base = `/gallery/search?q=${encodeURIComponent(q)}`;
  const results = { href: `/?q=${encodeURIComponent(q)}`, label: "Search results" };
  // Color the room after its most common region and period.
  const top = <T,>(xs: T[]) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<T, number>())].sort((a, b) => b[1] - a[1])[0]?.[0];
  const scene = buildScene({
    works: items,
    title,
    subtitle: "Search room",
    region: top(items.map((w) => w.region ?? "unassigned")) ?? "unassigned",
    periodStart: top(items.map((w) => w.yearStart ?? 1700)) ?? 1700,
    intro: [title, `${total} works from ${museumsIn(items)}, in chronological order.`],
    west: room > 1 ? { href: `${base}&room=${room - 1}`, label: `Room ${room - 1}` } : results,
    east: room < rooms ? { href: `${base}&room=${room + 1}`, label: `Room ${room + 1}` } : { href: "/gallery", label: "Floor plan" },
  });

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap items-center gap-4 text-sm">
        <Link href={results.href} className="text-muted hover:text-foreground">
          ← Results
        </Link>
        <span className="font-serif text-lg">Your room: {title}</span>
      </nav>
      <GalleryRoom key={`${q}-${room}`} scene={scene} />
    </div>
  );
}
