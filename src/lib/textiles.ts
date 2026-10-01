import { parseDimensions } from "./dimensions";

/**
 * Textiles a curator would hang: tapestries, hangings, carpets and rugs,
 * banners, quilts and coverlets of real size. Fragments, samples and
 * upholstery stay catalog-only.
 */
const DISPLAY = /\b(tapestry|tapestries|hanging|carpet|rug|banner|quilt|coverlet|bedcover|kesi)\b/i;
const EXCLUDE = /\b(fragment|sample|swatch|upholstery|border|band|trimming|piece)\b/i;
export const MIN_TEXTILE_CM = 80;

export function isDisplayTextile(text: string, dimensions: string | null | undefined): boolean {
  if (!DISPLAY.test(text) || EXCLUDE.test(text)) return false;
  const d = parseDimensions(dimensions);
  return !!d && Math.max(d.heightCm, d.widthCm) >= MIN_TEXTILE_CM;
}
