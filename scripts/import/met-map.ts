import type { NewArtwork, NewImage } from "../../src/db/schema";
import { parseDimensions, parseYears } from "../../src/lib/dimensions";

export const MET_INSTITUTION = "The Metropolitan Museum of Art";
export const MET_API = "https://collectionapi.metmuseum.org/public/collection/v1";
const CC0_URL = "https://creativecommons.org/publicdomain/zero/1.0/";

/** Row from MetObjects.csv (github.com/metmuseum/openaccess). */
export type MetCsvRow = Record<string, string>;

/** Subset of /public/collection/v1/objects/{id}. */
export type MetObject = {
  objectID: number;
  isPublicDomain: boolean;
  primaryImage: string;
  primaryImageSmall: string;
  title: string;
  artistDisplayName: string;
  objectDate: string;
  objectBeginDate: number;
  objectEndDate: number;
  medium: string;
  dimensions: string;
  classification: string;
  culture: string;
  creditLine: string;
  objectURL: string;
};

export function isPaintingRow(row: MetCsvRow): boolean {
  return /^paintings?\b/i.test((row["Classification"] ?? "").trim());
}

const orNull = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

export function artworkFromCsv(row: MetCsvRow): NewArtwork {
  const id = row["Object ID"].trim();
  const dims = parseDimensions(row["Dimensions"]);
  return {
    title: orNull(row["Title"]) ?? "Untitled",
    artistName: orNull(row["Artist Display Name"]?.split("|")[0]),
    dateDisplay: orNull(row["Object Date"]),
    ...parseYears(row["Object Begin Date"], row["Object End Date"]),
    medium: orNull(row["Medium"]),
    classification: orNull(row["Classification"]),
    culture: orNull(row["Culture"]),
    institution: MET_INSTITUTION,
    sourceRecordId: id,
    sourceRecordUrl: orNull(row["Link Resource"])?.replace(/^http:/, "https:") ??
      `https://www.metmuseum.org/art/collection/search/${id}`,
    creditLine: orNull(row["Credit Line"]),
    heightCm: dims?.heightCm ?? null,
    widthCm: dims?.widthCm ?? null,
    dimensionSource: dims?.source ?? null,
    dimensionConfidence: dims?.confidence ?? "unknown",
    rawSourceRecord: JSON.stringify(row),
  };
}

export function artworkFromApi(obj: MetObject): NewArtwork {
  const dims = parseDimensions(obj.dimensions);
  return {
    title: orNull(obj.title) ?? "Untitled",
    artistName: orNull(obj.artistDisplayName),
    dateDisplay: orNull(obj.objectDate),
    ...parseYears(obj.objectBeginDate, obj.objectEndDate),
    medium: orNull(obj.medium),
    classification: orNull(obj.classification),
    culture: orNull(obj.culture),
    institution: MET_INSTITUTION,
    sourceRecordId: String(obj.objectID),
    sourceRecordUrl: orNull(obj.objectURL) ?? `https://www.metmuseum.org/art/collection/search/${obj.objectID}`,
    creditLine: orNull(obj.creditLine),
    heightCm: dims?.heightCm ?? null,
    widthCm: dims?.widthCm ?? null,
    dimensionSource: dims?.source ?? null,
    dimensionConfidence: dims?.confidence ?? "unknown",
    rawSourceRecord: JSON.stringify(obj),
  };
}

export type ImageDecision =
  | { approved: true; image: Omit<NewImage, "artworkId"> }
  | { approved: false; reason: string; image: Omit<NewImage, "artworkId"> | null };

/**
 * Met rule: the object record itself must say isPublicDomain and provide a
 * primaryImage. The Met releases those images under CC0. Anything else stays
 * catalog-only.
 */
export function decideImage(obj: MetObject, checkedAt: string): ImageDecision {
  const imageUrl = orNull(obj.primaryImage);
  if (!imageUrl) return { approved: false, reason: "no primaryImage", image: null };

  const image = {
    imageUrl,
    thumbnailUrl: orNull(obj.primaryImageSmall),
    rightsBasis: obj.isPublicDomain ? ("CC0" as const) : ("UNKNOWN" as const),
    licenseUrl: obj.isPublicDomain ? CC0_URL : null,
    rightsStatement: obj.isPublicDomain
      ? "Public domain; image released by The Met under its Open Access policy (CC0)."
      : null,
    attributionText: "The Metropolitan Museum of Art",
    rightsEvidenceUrl: `${MET_API}/objects/${obj.objectID}`,
    rightsCheckedAt: checkedAt,
  };

  if (!obj.isPublicDomain) {
    return { approved: false, reason: "not public domain", image: { ...image, displayStatus: "BLOCKED" } };
  }
  if (!/^https:\/\/images\.metmuseum\.org\//.test(imageUrl)) {
    return { approved: false, reason: "unexpected image host", image: { ...image, displayStatus: "PENDING_REVIEW" } };
  }
  return { approved: true, image: { ...image, displayStatus: "APPROVED" } };
}
