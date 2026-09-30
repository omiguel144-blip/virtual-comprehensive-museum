import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../../src/db";
import { artworks, images, type NewArtwork, type NewImage } from "../../src/db/schema";

export function upsertArtwork(db: Db, artwork: NewArtwork): number {
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
 * Replaces the importer-managed image for an artwork. Rows a human has
 * touched (manualOverride) are left alone so imports never undo a takedown.
 * Returns false when a manual override blocked the write.
 */
export function upsertImage(db: Db, artworkId: number, image: Omit<NewImage, "artworkId">): boolean {
  const existing = db.select().from(images).where(eq(images.artworkId, artworkId)).all();
  if (existing.some((row) => row.manualOverride)) return false;

  const same = existing.find((row) => row.imageUrl === image.imageUrl);
  if (same) {
    db.update(images)
      .set({ ...image, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(images.id, same.id), eq(images.manualOverride, false)))
      .run();
  } else {
    db.insert(images).values({ ...image, artworkId }).run();
  }
  return true;
}

/** Blocks importer-managed images when the source no longer provides one. */
export function blockImages(db: Db, artworkId: number): void {
  db.update(images)
    .set({ displayStatus: "BLOCKED", updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(and(eq(images.artworkId, artworkId), eq(images.manualOverride, false)))
    .run();
}
