/**
 * Parses museum dimension strings into centimeters for the painted surface.
 * Prefers explicit cm values and unframed measurements; records which part
 * of the string was used so a human can audit it.
 */

export type ParsedDimensions = {
  heightCm: number;
  widthCm: number;
  source: string;
  confidence: "measured" | "estimated";
};

const FRAMED = /\b(framed|frame|overall|with frame|mount|stretcher|sight)\b/i;

// "91.4 x 152.4 cm" or "91,4 × 152,4 cm"; captures first two numbers.
const CM_PAIR = /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)(?:\s*[x×]\s*\d+(?:[.,]\d+)?)?\s*cm/i;

// "36 x 60 in." with optional fractions like "36 1/4 x 60 in."
const IN_PAIR = /(\d+(?:\s+\d+\/\d+)?(?:\.\d+)?)\s*[x×]\s*(\d+(?:\s+\d+\/\d+)?(?:\.\d+)?)\s*in\b/i;

function num(value: string): number {
  const trimmed = value.trim().replace(",", ".");
  const frac = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) + Number(frac[2]) / Number(frac[3]);
  return Number(trimmed);
}

function segments(raw: string): string[] {
  return raw
    .split(/\r?\n|;/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseSegment(segment: string): { h: number; w: number } | null {
  const cm = segment.match(CM_PAIR);
  if (cm) return { h: num(cm[1]), w: num(cm[2]) };
  const inch = segment.match(IN_PAIR);
  if (inch) return { h: num(inch[1]) * 2.54, w: num(inch[2]) * 2.54 };
  return null;
}

const round = (n: number) => Math.round(n * 10) / 10;

export function parseDimensions(raw: string | null | undefined): ParsedDimensions | null {
  if (!raw?.trim()) return null;
  const parts = segments(raw);

  // First choice: a segment that does not describe a frame or mount.
  const unframed = parts.filter((p) => !FRAMED.test(p));
  for (const part of unframed) {
    const parsed = parseSegment(part);
    if (parsed && parsed.h > 0 && parsed.w > 0) {
      return {
        heightCm: round(parsed.h),
        widthCm: round(parsed.w),
        source: part,
        // Measured when the segment is labeled as the painting, or is the only
        // unlabeled one and everything else is a frame or mount.
        confidence:
          /^(image|unframed|painting|panel|canvas|painted surface)\b/i.test(part) ||
          (unframed.length === 1 && !/^[a-z][a-z ]*:/i.test(part))
            ? "measured"
            : "estimated",
      };
    }
  }

  // Fallback: only framed sizes are known, so flag as estimated.
  for (const part of parts) {
    const parsed = parseSegment(part);
    if (parsed && parsed.h > 0 && parsed.w > 0) {
      return { heightCm: round(parsed.h), widthCm: round(parsed.w), source: part, confidence: "estimated" };
    }
  }
  return null;
}

/** Parses a year range from display dates like "ca. 1665–67" or "1889". */
export function parseYears(
  begin: number | string | null | undefined,
  end: number | string | null | undefined,
): { yearStart: number | null; yearEnd: number | null } {
  const toInt = (v: number | string | null | undefined) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  };
  const yearStart = toInt(begin);
  const yearEnd = toInt(end) ?? yearStart;
  return { yearStart, yearEnd };
}

export function century(year: number): number {
  return year > 0 ? Math.floor((year - 1) / 100) + 1 : -(Math.floor(-year / 100) + 1);
}
