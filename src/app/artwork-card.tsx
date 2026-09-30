import Link from "next/link";
import type { PublicArtwork } from "@/lib/queries";

export function ArtworkCard({ artwork }: { artwork: PublicArtwork }) {
  return (
    <Link
      href={`/artworks/${artwork.id}`}
      className="group flex flex-col overflow-hidden rounded border border-border bg-surface transition hover:shadow-md"
    >
      <div className="flex aspect-[4/5] items-center justify-center bg-background p-3">
        {artwork.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote museum images, sized by the source
          <img
            src={artwork.image.thumbnailUrl}
            alt={artwork.title}
            loading="lazy"
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <span className="px-4 text-center text-xs text-muted">Catalog record; image not shown</span>
        )}
      </div>
      <div className="space-y-1 p-3">
        <h2 className="font-serif leading-snug group-hover:text-accent">{artwork.title}</h2>
        <p className="text-sm text-muted">
          {[artwork.artistName, artwork.dateDisplay].filter(Boolean).join(", ") || "Unknown artist"}
        </p>
      </div>
    </Link>
  );
}
