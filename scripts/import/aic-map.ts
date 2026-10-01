import type { NewArtwork, NewImage } from "../../src/db/schema";
import { parseDimensions, parseYears } from "../../src/lib/dimensions";
import { isDisplayTextile } from "../../src/lib/textiles";

export const AIC_INSTITUTION = "Art Institute of Chicago";
export const AIC_IIIF = "https://www.artic.edu/iiif/2";
const CC0_URL = "https://creativecommons.org/publicdomain/zero/1.0/";

/** Subset of an artwork record from the AIC data dump (json/artworks/*.json). */
export type AicArtwork = {
  id: number;
  title: string | null;
  artist_title: string | null;
  artist_display: string | null;
  date_display: string | null;
  date_start: number | null;
  date_end: number | null;
  medium_display: string | null;
  dimensions: string | null;
  artwork_type_title: string | null;
  classification_title: string | null;
  place_of_origin: string | null;
  credit_line: string | null;
  is_public_domain: boolean;
  copyright_notice: string | null;
  image_id: string | null;
  thumbnail: { width?: number; height?: number } | null;
  timestamp?: string | null;
  updated_at?: string | null;
};

export const isAicPainting = (a: Pick<AicArtwork, "artwork_type_title">) => a.artwork_type_title === "Painting";

export const isAicTextile = (a: Pick<AicArtwork, "artwork_type_title" | "title" | "dimensions"> & { classification_titles?: string[] }) =>
  a.artwork_type_title === "Textile" &&
  isDisplayTextile(`${a.title ?? ""} ${(a.classification_titles ?? []).join(" ")}`, a.dimensions);

const orNull = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/**
 * AIC's recommended IIIF sizes: 843px wide for common use, larger for
 * close-ups. AIC's IIIF server refuses to upscale (HTTP 403), so a request is
 * capped at the source image's own width when that is known.
 */
export function aicImageUrl(imageId: string, width: 400 | 843 | 1686, sourceWidth?: number | null) {
  const w = sourceWidth && sourceWidth > 0 ? Math.min(width, Math.floor(sourceWidth)) : width;
  return `${AIC_IIIF}/${imageId}/full/${w},/0/default.jpg`;
}

export function artworkFromAic(a: AicArtwork): NewArtwork {
  const dims = parseDimensions(a.dimensions);
  return {
    title: orNull(a.title) ?? "Untitled",
    artistName: orNull(a.artist_title) ?? orNull(a.artist_display?.split("\n")[0]),
    dateDisplay: orNull(a.date_display),
    ...parseYears(a.date_start, a.date_end),
    medium: orNull(a.medium_display),
    classification: orNull(a.artwork_type_title),
    objectType: a.artwork_type_title === "Textile" ? "textile" : "painting",
    culture: orNull(a.place_of_origin),
    institution: AIC_INSTITUTION,
    sourceRecordId: String(a.id),
    sourceRecordUrl: `https://www.artic.edu/artworks/${a.id}`,
    creditLine: orNull(a.credit_line),
    heightCm: dims?.heightCm ?? null,
    widthCm: dims?.widthCm ?? null,
    dimensionSource: dims?.source ?? null,
    dimensionConfidence: dims?.confidence ?? "unknown",
    rawSourceRecord: JSON.stringify(a),
  };
}

export type ImageDecision =
  | { approved: true; image: Omit<NewImage, "artworkId"> }
  | { approved: false; reason: string; image: Omit<NewImage, "artworkId"> | null };

/**
 * AIC rule: the artwork record must say is_public_domain, have an image_id,
 * and carry no copyright notice. AIC releases those images under CC0. Its
 * IIIF server also returns images of copyrighted works, so an image_id alone
 * is never enough.
 */
export function decideAicImage(a: AicArtwork, fallbackCheckedAt: string): ImageDecision {
  const imageId = orNull(a.image_id);
  if (!imageId) return { approved: false, reason: "no image_id", image: null };
  if (!a.is_public_domain) return { approved: false, reason: "not public domain", image: null };

  const sourceWidth = a.thumbnail?.width;
  const image = {
    imageUrl: aicImageUrl(imageId, 1686, sourceWidth),
    thumbnailUrl: aicImageUrl(imageId, 843, sourceWidth),
    pixelWidth: a.thumbnail?.width ?? null,
    pixelHeight: a.thumbnail?.height ?? null,
    rightsBasis: "CC0" as const,
    licenseUrl: CC0_URL,
    rightsStatement: "Public domain; image released by the Art Institute of Chicago under CC0.",
    attributionText: "The Art Institute of Chicago",
    rightsEvidenceUrl: `https://api.artic.edu/api/v1/artworks/${a.id}?fields=id,is_public_domain,image_id,copyright_notice`,
    // The dump's own timestamp is when the rights flag was last known true.
    rightsCheckedAt: orNull(a.timestamp) ?? orNull(a.updated_at) ?? fallbackCheckedAt,
  };

  if (orNull(a.copyright_notice)) {
    return {
      approved: false,
      reason: "public domain flag conflicts with copyright notice",
      image: { ...image, rightsBasis: "UNKNOWN", licenseUrl: null, rightsStatement: null, displayStatus: "PENDING_REVIEW" },
    };
  }
  return { approved: true, image: { ...image, displayStatus: "APPROVED" } };
}

/** Fields requested from the live AIC API when re-verifying stored images. */
export const AIC_VERIFY_FIELDS = "id,is_public_domain,image_id,copyright_notice,thumbnail";

export type AicLiveRecord = Pick<AicArtwork, "id" | "is_public_domain" | "image_id" | "copyright_notice"> & {
  thumbnail?: AicArtwork["thumbnail"];
};

export type AicVerification =
  | { action: "confirm" }
  | {
      action: "update";
      imageUrl: string;
      thumbnailUrl: string;
      pixelWidth: number | null;
      pixelHeight: number | null;
    }
  | { action: "block"; reason: string };

/**
 * Compares a stored AIC image with the live API record. The dump can be over
 * a year old, so the live record decides: anything not clearly still open
 * access is blocked.
 */
export function decideAicVerification(
  stored: { imageUrl: string; thumbnailUrl: string | null; pixelWidth: number | null; pixelHeight: number | null },
  live: AicLiveRecord | undefined,
): AicVerification {
  if (!live) return { action: "block", reason: "record no longer in the AIC API" };
  if (!live.is_public_domain) return { action: "block", reason: "no longer public domain" };
  if (orNull(live.copyright_notice)) return { action: "block", reason: "copyright notice added" };
  const imageId = orNull(live.image_id);
  if (!imageId) return { action: "block", reason: "image removed" };
  // Live dimensions win; fall back to stored ones if the API omits them.
  const pixelWidth = live.thumbnail?.width ?? stored.pixelWidth ?? null;
  const pixelHeight = live.thumbnail?.height ?? stored.pixelHeight ?? null;
  const imageUrl = aicImageUrl(imageId, 1686, pixelWidth);
  const thumbnailUrl = aicImageUrl(imageId, 843, pixelWidth);
  if (imageUrl === stored.imageUrl && thumbnailUrl === stored.thumbnailUrl) return { action: "confirm" };
  return { action: "update", imageUrl, thumbnailUrl, pixelWidth, pixelHeight };
}
