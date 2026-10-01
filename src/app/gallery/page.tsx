import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db";
import { listGalleries, ROOM_SIZE, type GallerySummary } from "@/lib/queries";
import { periodLabel, REGIONS } from "@/lib/regions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Galleries" };

const WINGS = ["Europe", "Americas", "Asia", "Africa", "Ancient", "Other"] as const;

export default async function FloorPlanPage() {
  const galleries = await listGalleries(getDb());
  const byRegion = new Map<string, GallerySummary[]>();
  for (const g of galleries) byRegion.set(g.region, [...(byRegion.get(g.region) ?? []), g]);
  const total = galleries.reduce((n, g) => n + g.count, 0);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl">Galleries</h1>
        <p className="max-w-2xl text-muted">
          {total.toLocaleString()} works hung at life size in {galleries.length} galleries, arranged by region and
          period as in an encyclopedic museum. Each room reads chronologically; doorways lead to the next period.
          Use the search bar to hang a room of your own.
        </p>
      </header>

      {galleries.length === 0 && (
        <p className="py-16 text-center text-muted">No galleries yet. Run the importers to fill the museum.</p>
      )}

      {WINGS.map((wing) => {
        const regions = REGIONS.filter((r) => r.wing === wing && byRegion.has(r.key));
        if (regions.length === 0) return null;
        return (
          <section key={wing} className="space-y-5">
            <h2 className="border-b border-border pb-2 font-serif text-2xl">{wing}</h2>
            {regions.map((region) => (
              <div key={region.key} className="space-y-3">
                <h3 className="text-sm font-medium uppercase tracking-wide text-muted">{region.label}</h3>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {byRegion.get(region.key)!.map((g) => (
                    <li key={g.galleryKey}>
                      <Link
                        href={`/gallery/${g.galleryKey}`}
                        className="group block overflow-hidden rounded border border-border bg-surface transition hover:shadow-md"
                      >
                        <div className="flex aspect-[4/3] items-center justify-center bg-[#2b2622] p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element -- rights-gated route */}
                          <img
                            src={`/api/gallery-image/${g.coverId}`}
                            alt=""
                            loading="lazy"
                            className="max-h-full max-w-full object-contain transition group-hover:scale-[1.03]"
                          />
                        </div>
                        <div className="space-y-0.5 p-2.5">
                          <p className="font-serif text-sm leading-snug">{periodLabel(g.region, g.period)}</p>
                          <p className="text-xs text-muted">
                            {g.count} {g.count === 1 ? "work" : "works"}
                            {g.count > ROOM_SIZE && ` · ${Math.ceil(g.count / ROOM_SIZE)} rooms`}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
