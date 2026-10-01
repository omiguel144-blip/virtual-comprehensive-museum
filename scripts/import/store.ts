import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../../src/db";
import { artworks, images, type NewArtwork, type NewImage } from "../../src/db/schema";
import { deriveFields } from "../../src/lib/classify";

export function upsertArtwork(db: Db, input: NewArtwork): number {
  // Region, period, gallery, search text and display mode are always derived.
  const artwork = { ...input, ...deriveFields(input) };
  const [row] = db
    .insert(artworks)
    .values(artwork)
    .onConflictDoUpdate({
      target: [artworks.institution, artworks.sourceRecordId],
      set: {
        ...artwork,
        // Keep a known Wikidata ID if this source doesn't provide one.
        wikidataId: sql`coalesce(excluded.wikidata_id, ${artworks.wikidataId})`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      },
    })
    .returning({ id: artworks.id })
    .all();
  return row.id;
}

/**
 * Replaces the importer-managed image for an artwork (one per artwork), even
 * when the source changed its URL. Rows a human has touched (manualOverride)
 * are left alone so imports never undo a takedown.
 * Returns false when a manual override blocked the write.
 */
export function upsertImage(db: Db, artworkId: number, image: Omit<NewImage, "artworkId">): boolean {
  const existing = db.select().from(images).where(eq(images.artworkId, artworkId)).orderBy(images.id).all();
  if (existing.some((row) => row.manualOverride)) return false;

  const [keep, ...extra] = existing;
  db.transaction((tx) => {
    if (keep) {
      tx.update(images)
        .set({ ...image, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(and(eq(images.id, keep.id), eq(images.manualOverride, false)))
        .run();
    } else {
      tx.insert(images).values({ ...image, artworkId }).run();
    }
    // Older importer rows with outdated URLs would otherwise be shown first.
    for (const row of extra) tx.delete(images).where(eq(images.id, row.id)).run();
  });
  return true;
}

/** Blocks importer-managed images when the source no longer provides one. */
export function blockImages(db: Db, artworkId: number): void {
  db.update(images)
    .set({ displayStatus: "BLOCKED", updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(and(eq(images.artworkId, artworkId), eq(images.manualOverride, false)))
    .run();
}
