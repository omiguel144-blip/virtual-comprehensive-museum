import { and, asc, count, eq, gte, inArray, isNull, like, lte, or, sql, type SQL } from "drizzle-orm";
import { artworks, images, type Artwork } from "@/db/schema";
import type { Db } from "@/db";
import { fold } from "./regions";
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

/** Splits a query into accent-folded words; LIKE wildcards are escaped away. */
export function searchWords(q: string | null | undefined): string[] {
  return fold(q)
    .replace(/[%_\\]/g, " ")
    .split(/[^a-z0-9']+/)
    .filter((w) => w.length > 0)
    .slice(0, 8);
}

// Mirrors the gate's cheap checks in SQL so "with images" filtering and counts
// stay close; the gate itself still makes the final call per row.
const hasApprovedImage = sql`exists (select 1 from ${images} where ${images.artworkId} = ${artworks.id} and ${images.displayStatus} = 'APPROVED' and ${images.rightsBasis} != 'UNKNOWN')`;

function buildWhere(filters: CatalogFilters): SQL | undefined {
  // Confirmed duplicates are reachable from their canonical record, not listed.
  const conditions: SQL[] = [isNull(artworks.duplicateOf)];
  // Every word must appear somewhere (title, artist, medium, culture, region, period...).
  for (const word of searchWords(filters.q)) {
    conditions.push(like(artworks.searchText, `%${word}%`));
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

export const ROOM_SIZE = 30;

export type HangableArtwork = PublicArtwork & { image: DisplayImage; heightCm: number; widthCm: number };

/**
 * Works that can hang in 3D: an image that passes the rights gate and a
 * measured (not estimated) physical size, so scale is honest.
 */
function hangableWhere(extra: SQL | undefined) {
  return and(
    buildWhere({ withImages: true }),
    extra,
    eq(artworks.dimensionConfidence, "measured"),
    // Skip fragments and works too large for a room.
    gte(artworks.heightCm, 5),
    lte(artworks.heightCm, 450),
    gte(artworks.widthCm, 5),
    lte(artworks.widthCm, 1500),
  );
}

export type GallerySummary = {
  galleryKey: string;
  region: string;
  period: string;
  count: number;
  startYear: number | null;
  coverId: number;
};

/** Every gallery that has hangable works, with a count and a cover work (the largest). */
export async function listGalleries(db: Db): Promise<GallerySummary[]> {
  const rows = await db
    .select({
      galleryKey: artworks.galleryKey,
      region: artworks.region,
      period: artworks.period,
      count: count(),
      startYear: sql<number | null>`min(${artworks.yearStart})`,
      // SQLite returns the row holding the max() for bare columns.
      area: sql<number>`max(${artworks.heightCm} * ${artworks.widthCm})`,
      coverId: artworks.id,
    })
    .from(artworks)
    .where(hangableWhere(sql`${artworks.galleryKey} is not null`))
    .groupBy(artworks.galleryKey);
  return rows
    .filter((r) => r.galleryKey && r.region && r.period)
    .map((r) => ({
      galleryKey: r.galleryKey!,
      region: r.region!,
      period: r.period!,
      count: r.count,
      startYear: r.startYear,
      coverId: r.coverId,
    }))
    .sort((a, b) => (a.startYear ?? Infinity) - (b.startYear ?? Infinity));
}

export type GalleryQuery = { galleryKey?: string; q?: string; room?: number };

/** One room's worth of works (up to ROOM_SIZE), in chronological order. */
export async function listGalleryArtworks(db: Db, query: GalleryQuery) {
  const extra = query.galleryKey
    ? eq(artworks.galleryKey, query.galleryKey)
    : buildWhere({ q: query.q });
  if (!query.galleryKey && searchWords(query.q).length === 0) return { items: [] as HangableArtwork[], total: 0, room: 1, rooms: 0 };
  const where = hangableWhere(extra);
  const [{ total }] = await db.select({ total: count() }).from(artworks).where(where);
  const rooms = Math.max(1, Math.ceil(total / ROOM_SIZE));
  const room = Math.min(Math.max(query.room ?? 1, 1), rooms);
  const rows = await db
    .select()
    .from(artworks)
    .where(where)
    .orderBy(sql`${artworks.yearStart} is null`, asc(artworks.yearStart), asc(artworks.artistName), asc(artworks.id))
    .limit(ROOM_SIZE)
    .offset((room - 1) * ROOM_SIZE);
  // The SQL filter mirrors the gate; the gate itself makes the final call.
  const items = (await attachImages(db, rows)).filter((a): a is HangableArtwork =>
    Boolean(a.image && a.heightCm && a.widthCm),
  );
  return { items, total, room, rooms };
}
