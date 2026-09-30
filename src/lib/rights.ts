import type { Image } from "@/db/schema";

/**
 * The single rights gate. Every code path that could expose an image URL
 * (lists, detail pages, API responses, social previews, 3D textures) must
 * go through `getDisplayImage`. Anything that fails returns null: the
 * artwork is still shown, just catalog-only.
 */

export type DisplayImage = {
  imageUrl: string;
  thumbnailUrl: string;
  pixelWidth: number | null;
  pixelHeight: number | null;
  rightsBasis: Image["rightsBasis"];
  licenseUrl: string | null;
  rightsStatement: string | null;
  attributionText: string | null;
};

export type GateResult = { ok: true } | { ok: false; reason: string };

type GateInput = Pick<
  Image,
  | "imageUrl"
  | "displayStatus"
  | "rightsBasis"
  | "licenseUrl"
  | "attributionText"
  | "rightsEvidenceUrl"
  | "rightsCheckedAt"
>;

function isHttpsUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function checkImage(image: GateInput): GateResult {
  if (image.displayStatus !== "APPROVED") {
    return { ok: false, reason: `status ${image.displayStatus}` };
  }
  if (!isHttpsUrl(image.imageUrl)) return { ok: false, reason: "invalid image URL" };
  if (!image.rightsCheckedAt) return { ok: false, reason: "rights never checked" };
  if (!isHttpsUrl(image.rightsEvidenceUrl)) {
    return { ok: false, reason: "no rights evidence URL" };
  }

  switch (image.rightsBasis) {
    case "CC0":
    case "PUBLIC_DOMAIN":
      return { ok: true };
    case "CC_BY":
      // Attribution licenses are only usable if we can meet the conditions.
      if (!image.attributionText?.trim()) return { ok: false, reason: "CC BY without attribution" };
      if (!isHttpsUrl(image.licenseUrl)) return { ok: false, reason: "CC BY without license URL" };
      return { ok: true };
    case "PERMISSION":
      return { ok: true };
    case "UNKNOWN":
    default:
      return { ok: false, reason: "unknown rights" };
  }
}

export function isDisplayable(image: GateInput): boolean {
  return checkImage(image).ok;
}

/** Picks the first approved image for an artwork, or null for catalog-only. */
export function getDisplayImage(candidates: readonly Image[]): DisplayImage | null {
  const image = candidates.find(isDisplayable);
  if (!image) return null;
  return {
    imageUrl: image.imageUrl,
    thumbnailUrl: isHttpsUrl(image.thumbnailUrl) ? image.thumbnailUrl! : image.imageUrl,
    pixelWidth: image.pixelWidth,
    pixelHeight: image.pixelHeight,
    rightsBasis: image.rightsBasis,
    licenseUrl: image.licenseUrl,
    rightsStatement: image.rightsStatement,
    attributionText: image.attributionText,
  };
}
