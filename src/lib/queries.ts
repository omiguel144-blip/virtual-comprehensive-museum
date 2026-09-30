import { and, asc, count, eq, gte, inArray, isNull, like, lte, or, sql, type SQL } from "drizzle-orm";
import { artworks, images, type Artwork } from "@/db/schema";
import type { Db } from "@/db";
import { getDisplayImage, type DisplayImage } from "./rights";

/**
 * Public read paths. Raw `images` rows never leave this module; callers get
 * `image: DisplayImage | null` produced by the rights gate.
 */

export type PublicArtwork = Omit<Artwork, "rawSourceRecord"> & {
  image: DisplayImage | null;
};

export type CatalogFilters = {
  q?: string;
  century?: number;
  institution?: string;
  withImages?: boolean;
  page?: number;
  pageSize?: number;
};

export const PAGE_SIZE = 24;

async function attachImages(db: Db, rows: Artwork[]): Promise<PublicArtwork[]> {
  if (rows.length === 0) return [];
  const imageRows = await db
    .select()
    .from(images)
    .where(inArray(images.artworkId, rows.map((r) => r.id)))
    .orderBy(asc(images.id));
  return rows.map((row) => {
    const artwork: Partial<Artwork> = { ...row };
    delete artwork.rawSourceRecord;
    return {
      ...(artwork as Omit<Artwork, "rawSourceRecord">),
      image: getDisplayImage(imageRows.filter((img) => img.artworkId === row.id)),
    };
  });
}

// Mirrors the gate's cheap checks in SQL so "with images" filtering and counts
// stay close; the gate itself still makes the final call per row.
const hasApprovedImage = sql`exists (select 1 from ${images} where ${images.artworkId} = ${artworks.id} and ${images.displayStatus} = 'APPROVED' and ${images.rightsBasis} != 'UNKNOWN')`;

function buildWhere(filters: CatalogFilters): SQL | undefined {
  // Confirmed duplicates are reachable from their canonical record, not listed.
  const conditions: SQL[] = [isNull(artworks.duplicateOf)];
  const q = filters.q?.trim();
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        like(artworks.title, pattern),
        like(artworks.artistName, pattern),
        like(artworks.medium, pattern),
        like(artworks.culture, pattern),
      )!,
    );
  }
  if (filters.century) {
    const c = filters.century;
    const start = c > 0 ? (c - 1) * 100 + 1 : c * 100;
    const end = c > 0 ? c * 100 : (c + 1) * 100 - 1;
    conditions.push(and(gte(artworks.yearStart, start), lte(artworks.yearStart, end))!);
  }
  if (filters.institution) conditions.push(eq(artworks.institution, filters.institution));
  if (filters.withImages) conditions.push(hasApprovedImage);
  return conditions.length ? and(...conditions) : undefined;
}

export async function listArtworks(db: Db, filters: CatalogFilters = {}) {
  const pageSize = Math.min(Math.max(filters.pageSize ?? PAGE_SIZE, 1), 100);
  const page = Math.max(filters.page ?? 1, 1);
  const where = buildWhere(filters);

  const [{ total }] = await db.select({ total: count() }).from(artworks).where(where);
  const rows = await db
    .select()
    .from(artworks)
    .where(where)
    .orderBy(sql`${artworks.yearStart} is null`, asc(artworks.yearStart), asc(artworks.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { items: await attachImages(db, rows), total, page, pageSize };
}

export async function getArtwork(db: Db, id: number): Promise<PublicArtwork | null> {
  if (!Number.isInteger(id) || id < 1) return null;
  const rows = await db.select().from(artworks).where(eq(artworks.id, id)).limit(1);
  const [artwork] = await attachImages(db, rows);
  return artwork ?? null;
}

export type RelatedRecord = { id: number; institution: string; sourceRecordUrl: string; title: string };

/** Other records of the same object: its canonical record and everything merged into it. */
export async function getRelatedRecords(db: Db, artwork: Pick<Artwork, "id" | "duplicateOf">): Promise<RelatedRecord[]> {
  const root = artwork.duplicateOf ?? artwork.id;
  const rows = await db
    .select({ id: artworks.id, institution: artworks.institution, sourceRecordUrl: artworks.sourceRecordUrl, title: artworks.title })
    .from(artworks)
    .where(or(eq(artworks.id, root), eq(artworks.duplicateOf, root)))
    .orderBy(asc(artworks.id));
  return rows.filter((r) => r.id !== artwork.id);
}

export async function listInstitutions(db: Db): Promise<string[]> {
  const rows = await db
    .selectDistinct({ institution: artworks.institution })
    .from(artworks)
    .orderBy(asc(artworks.institution));
  return rows.map((r) => r.institution);
}

export type GalleryFilters = { century?: number; institution?: string; limit?: number };

/**
 * Paintings for the 3D room: only works with an image that passes the rights
 * gate and a measured (not estimated) physical size, so scale is honest.
 */
export async function listGalleryArtworks(db: Db, filters: GalleryFilters = {}) {
  const limit = Math.min(Math.max(filters.limit ?? 12, 1), 24);
  const where = and(
    buildWhere({ century: filters.century, institution: filters.institution, withImages: true }),
    eq(artworks.dimensionConfidence, "measured"),
    // Skip miniatures and huge works that don't read well in one room.
    gte(artworks.heightCm, 15),
    lte(artworks.heightCm, 380),
    gte(artworks.widthCm, 15),
    lte(artworks.widthCm, 600),
  );
  const rows = await db
    .select()
    .from(artworks)
    .where(where)
    .orderBy(asc(artworks.yearStart), asc(artworks.id))
    .limit(limit * 2);
  // The SQL filter mirrors the gate; the gate itself makes the final call.
  return (await attachImages(db, rows))
    .filter((a): a is PublicArtwork & { image: DisplayImage; heightCm: number; widthCm: number } =>
      Boolean(a.image && a.heightCm && a.widthCm),
    )
    .slice(0, limit);
}
