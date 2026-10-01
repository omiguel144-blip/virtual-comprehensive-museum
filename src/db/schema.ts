import { sql } from "drizzle-orm";
import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

export const RIGHTS_BASES = [
  "CC0",
  "PUBLIC_DOMAIN",
  "CC_BY",
  "PERMISSION",
  "UNKNOWN",
] as const;
export type RightsBasis = (typeof RIGHTS_BASES)[number];

export const DISPLAY_STATUSES = [
  "BLOCKED",
  "PENDING_REVIEW",
  "APPROVED",
  "WITHDRAWN",
] as const;
export type DisplayStatus = (typeof DISPLAY_STATUSES)[number];

export const OBJECT_TYPES = ["painting", "textile", "work_on_paper"] as const;
export type ObjectType = (typeof OBJECT_TYPES)[number];

/** How the 3D gallery presents a work: on a wall, in a tabletop case, or in a long scroll case. */
export const DISPLAY_MODES = ["wall", "case", "scroll_case"] as const;
export type DisplayMode = (typeof DISPLAY_MODES)[number];

export const DIMENSION_CONFIDENCE = ["measured", "estimated", "unknown"] as const;
export type DimensionConfidence = (typeof DIMENSION_CONFIDENCE)[number];

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
};

export const artworks = sqliteTable(
  "artworks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    artistName: text("artist_name"),
    dateDisplay: text("date_display"),
    yearStart: integer("year_start"),
    yearEnd: integer("year_end"),
    medium: text("medium"),
    classification: text("classification"),
    culture: text("culture"),
    institution: text("institution").notNull(),
    sourceRecordId: text("source_record_id").notNull(),
    sourceRecordUrl: text("source_record_url").notNull(),
    creditLine: text("credit_line"),
    // Physical size of the painted surface, used later for life-scale 3D.
    heightCm: real("height_cm"),
    widthCm: real("width_cm"),
    // Which measurement the dimension parser chose, e.g. "unframed" or the raw text.
    dimensionSource: text("dimension_source"),
    dimensionConfidence: text("dimension_confidence", {
      enum: DIMENSION_CONFIDENCE,
    })
      .notNull()
      .default("unknown"),
    objectType: text("object_type", { enum: OBJECT_TYPES }).notNull().default("painting"),
    displayMode: text("display_mode", { enum: DISPLAY_MODES }).notNull().default("wall"),
    // Curatorial grouping, derived by src/lib/classify.ts (recompute with `npm run classify`).
    region: text("region"),
    period: text("period"),
    galleryKey: text("gallery_key"),
    // Lowercased, accent-folded text for search.
    searchText: text("search_text"),
    // Shared identifier across collections (e.g. "Q87480807"), used for deduplication.
    wikidataId: text("wikidata_id"),
    // Set when this record is a confirmed duplicate of another; hidden from lists.
    duplicateOf: integer("duplicate_of"),
    // Original record as JSON, kept for audits.
    rawSourceRecord: text("raw_source_record"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("artworks_source_unique").on(t.institution, t.sourceRecordId),
    index("artworks_wikidata_idx").on(t.wikidataId),
    index("artworks_gallery_idx").on(t.galleryKey),
    index("artworks_duplicate_idx").on(t.duplicateOf),
    index("artworks_year_idx").on(t.yearStart),
    index("artworks_artist_idx").on(t.artistName),
  ],
);

export const images = sqliteTable(
  "images",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    artworkId: integer("artwork_id")
      .notNull()
      .references(() => artworks.id, { onDelete: "cascade" }),
    imageUrl: text("image_url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    pixelWidth: integer("pixel_width"),
    pixelHeight: integer("pixel_height"),
    rightsBasis: text("rights_basis", { enum: RIGHTS_BASES })
      .notNull()
      .default("UNKNOWN"),
    licenseUrl: text("license_url"),
    rightsStatement: text("rights_statement"),
    attributionText: text("attribution_text"),
    rightsEvidenceUrl: text("rights_evidence_url"),
    rightsCheckedAt: text("rights_checked_at"),
    displayStatus: text("display_status", { enum: DISPLAY_STATUSES })
      .notNull()
      .default("PENDING_REVIEW"),
    // Set by a human (e.g. a takedown). Imports never overwrite these rows.
    manualOverride: integer("manual_override", { mode: "boolean" })
      .notNull()
      .default(false),
    ...timestamps,
  },
  (t) => [index("images_artwork_idx").on(t.artworkId)],
);

export const DUPLICATE_STATUSES = ["PENDING", "CONFIRMED", "REJECTED"] as const;
export type DuplicateStatus = (typeof DUPLICATE_STATUSES)[number];

/** Possible duplicate pairs. artworkA < artworkB; decisions are never re-proposed. */
export const duplicateCandidates = sqliteTable(
  "duplicate_candidates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    artworkA: integer("artwork_a")
      .notNull()
      .references(() => artworks.id, { onDelete: "cascade" }),
    artworkB: integer("artwork_b")
      .notNull()
      .references(() => artworks.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    score: real("score").notNull(),
    status: text("status", { enum: DUPLICATE_STATUSES }).notNull().default("PENDING"),
    decidedBy: text("decided_by"), // "auto:wikidata" or "human"
    decidedAt: text("decided_at"),
    ...timestamps,
  },
  (t) => [uniqueIndex("duplicate_pair_unique").on(t.artworkA, t.artworkB)],
);

export type Artwork = typeof artworks.$inferSelect;
export type DuplicateCandidate = typeof duplicateCandidates.$inferSelect;
export type NewArtwork = typeof artworks.$inferInsert;
export type Image = typeof images.$inferSelect;
export type NewImage = typeof images.$inferInsert;
