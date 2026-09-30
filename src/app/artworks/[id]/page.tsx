import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import Link from "next/link";
import { getArtwork, getRelatedRecords } from "@/lib/queries";

export const dynamic = "force-dynamic";

async function load(params: Promise<{ id: string }>) {
  const { id } = await params;
  return getArtwork(getDb(), Number(id));
}

export async function generateMetadata({ params }: PageProps<"/artworks/[id]">): Promise<Metadata> {
  const artwork = await load(params);
  if (!artwork) return {};
  return {
    title: artwork.title,
    description: [artwork.artistName, artwork.dateDisplay, artwork.institution].filter(Boolean).join(", "),
    // Social previews go through the same rights gate as the page.
    openGraph: artwork.image ? { images: [artwork.image.thumbnailUrl] } : undefined,
  };
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 border-b border-border py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default async function ArtworkPage({ params }: PageProps<"/artworks/[id]">) {
  const artwork = await load(params);
  if (!artwork) notFound();
  const { image } = artwork;
  const related = await getRelatedRecords(getDb(), artwork);

  const size =
    artwork.heightCm && artwork.widthCm
      ? `${artwork.heightCm} × ${artwork.widthCm} cm${artwork.dimensionConfidence === "estimated" ? " (estimated)" : ""}`
      : null;

  return (
    <article className="grid gap-8 lg:grid-cols-[3fr_2fr]">
      <div className="flex min-h-80 items-center justify-center rounded border border-border bg-surface p-4">
        {image ? (
          <a href={image.imageUrl} target="_blank" rel="noreferrer" title="Open full-resolution image">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote museum images, sized by the source */}
            <img src={image.imageUrl} alt={artwork.title} className="max-h-[80vh] w-auto object-contain" />
          </a>
        ) : (
          <div className="max-w-sm space-y-3 text-center">
            <p className="font-serif text-lg">Image not shown</p>
            <p className="text-sm text-muted">
              We have not verified that this image may be reused, so we link to the holding institution instead.
            </p>
            <a href={artwork.sourceRecordUrl} target="_blank" rel="noreferrer" className="inline-block text-accent underline">
              View at {artwork.institution}
            </a>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {artwork.duplicateOf && (
          <p className="rounded border border-border bg-surface p-3 text-sm">
            This is a second record of the same work.{" "}
            <Link href={`/artworks/${artwork.duplicateOf}`} className="text-accent underline">
              See the main record
            </Link>
            .
          </p>
        )}
        <header className="space-y-1">
          <h1 className="font-serif text-3xl leading-tight">{artwork.title}</h1>
          <p className="text-muted">
            {[artwork.artistName ?? "Unknown artist", artwork.dateDisplay].filter(Boolean).join(", ")}
          </p>
        </header>

        <dl>
          <Field label="Medium" value={artwork.medium} />
          <Field label="Dimensions" value={size} />
          <Field label="Culture" value={artwork.culture} />
          <Field label="Classification" value={artwork.classification} />
          <Field label="Institution" value={artwork.institution} />
          <Field label="Credit line" value={artwork.creditLine} />
        </dl>

        <section className="space-y-2 rounded border border-border bg-surface p-4 text-sm">
          <h2 className="font-medium">Source and rights</h2>
          {image ? (
            <>
              <p>{image.rightsStatement ?? image.rightsBasis}</p>
              {image.attributionText && <p>Image: {image.attributionText}</p>}
              {image.licenseUrl && (
                <p>
                  <a href={image.licenseUrl} target="_blank" rel="noreferrer" className="text-accent underline">
                    License
                  </a>
                </p>
              )}
            </>
          ) : (
            <p className="text-muted">Catalog information only.</p>
          )}
          <p>
            <a href={artwork.sourceRecordUrl} target="_blank" rel="noreferrer" className="text-accent underline">
              Original record at {artwork.institution}
            </a>
          </p>
          {related.length > 0 && (
            <div className="border-t border-border pt-2">
              <p className="text-muted">Also recorded as:</p>
              <ul className="list-disc pl-5">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link href={`/artworks/${r.id}`} className="underline">
                      {r.institution}
                    </Link>{" "}
                    (
                    <a href={r.sourceRecordUrl} target="_blank" rel="noreferrer" className="text-accent underline">
                      source
                    </a>
                    )
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </article>
  );
}
