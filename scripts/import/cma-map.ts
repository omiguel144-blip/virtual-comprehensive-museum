import type { NewArtwork, NewImage } from "../../src/db/schema";
import { parseDimensions, parseYears } from "../../src/lib/dimensions";

export const CMA_INSTITUTION = "Cleveland Museum of Art";
export const CMA_API = "https://openaccess-api.clevelandart.org/api/artworks";
const CC0_URL = "https://creativecommons.org/publicdomain/zero/1.0/";

/** Row from the CMA Open Access data.csv (github.com/ClevelandMuseumArt/openaccess). */
export type CmaRow = Record<string, string>;

export const isCmaPainting = (row: CmaRow) => row["type"] === "Painting";

const orNull = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/** "Pierre Bonnard (French, 1867–1947), artist; Someone (...), workshop" -> "Pierre Bonnard" */
export function cmaArtistName(creators: string | null | undefined): string | null {
  const first = orNull(creators?.split(";")[0]);
  if (!first) return null;
  return orNull(first.replace(/\s*\(.*$/, "").replace(/,\s*[a-z ]+$/i, ""));
}

export function artworkFromCma(row: CmaRow): NewArtwork {
  const dims = parseDimensions(row["measurements"]);
  return {
    title: orNull(row["title"]) ?? "Untitled",
    artistName: cmaArtistName(row["creators"]),
    dateDisplay: orNull(row["creation_date"]),
    ...parseYears(row["creation_date_earliest"], row["creation_date_latest"]),
    medium: orNull(row["technique"]),
    classification: orNull(row["type"]),
    culture: orNull(row["culture"]),
    institution: CMA_INSTITUTION,
    sourceRecordId: row["id"].trim(),
    sourceRecordUrl: orNull(row["url"]) ?? `https://clevelandart.org/art/${row["accession_number"]}`,
    creditLine: orNull(row["creditline"]),
    heightCm: dims?.heightCm ?? null,
    widthCm: dims?.widthCm ?? null,
    dimensionSource: dims?.source ?? null,
    dimensionConfidence: dims?.confidence ?? "unknown",
    rawSourceRecord: JSON.stringify(row),
  };
}

export type ImageDecision =
  | { approved: true; image: Omit<NewImage, "artworkId"> }
  | { approved: false; reason: string; image: Omit<NewImage, "artworkId"> | null };

const CDN = /^https:\/\/openaccess-cdn\.clevelandart\.org\//;

/**
 * CMA rule: share_license_status must be CC0 and the record must include an
 * open-access image on CMA's CDN. CMA withholds image files for copyrighted
 * works; a CC0 flag next to a copyright notice is held for review.
 */
export function decideCmaImage(row: CmaRow, checkedAt: string): ImageDecision {
  const web = orNull(row["image_web"]);
  const print = orNull(row["image_print"]);
  const license = row["share_license_status"];
  if (license !== "CC0") return { approved: false, reason: `license ${license || "missing"}`, image: null };
  if (!web) return { approved: false, reason: "no image", image: null };

  const image = {
    imageUrl: print ?? web,
    thumbnailUrl: web,
    rightsBasis: "CC0" as const,
    licenseUrl: CC0_URL,
    rightsStatement: "Public domain; image released by the Cleveland Museum of Art under CC0.",
    attributionText: orNull(row["image_credit"]) ?? "The Cleveland Museum of Art",
    rightsEvidenceUrl: `${CMA_API}/${row["id"].trim()}`,
    rightsCheckedAt: checkedAt,
  };

  if (!CDN.test(web) || (print && !CDN.test(print))) {
    return { approved: false, reason: "unexpected image host", image: { ...image, displayStatus: "PENDING_REVIEW" } };
  }
  if (orNull(row["copyright"])) {
    return {
      approved: false,
      reason: "CC0 flag conflicts with copyright notice",
      image: { ...image, rightsBasis: "UNKNOWN", licenseUrl: null, rightsStatement: null, displayStatus: "PENDING_REVIEW" },
    };
  }
  return { approved: true, image: { ...image, displayStatus: "APPROVED" } };
}
