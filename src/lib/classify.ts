import type { DisplayMode, NewArtwork, ObjectType } from "@/db/schema";
import { classifyRegion, fold, galleryKey, periodFor, regionLabel, type RegionHints } from "./regions";

/** Pulls region hints out of each museum's original record. */
export function hintsFromRaw(institution: string, raw: Record<string, unknown> | null): RegionHints {
  if (!raw) return {};
  const str = (v: unknown) => (typeof v === "string" ? v : Array.isArray(v) ? v.join(", ") : null);
  // "Name (French, 1841–1919)" or AIC's "Name\nAmerican, 1899–1965" -> nationality or place
  const nationalityIn = (v: unknown) => {
    const s = str(v);
    if (!s) return null;
    const paren = s.match(/\(([^,()]+?)(?:,|\))/)?.[1];
    if (paren) return paren;
    const second = s.split("\n")[1];
    return second ? second.trim() : null;
  };

  if (institution.includes("Metropolitan")) {
    return {
      culture: str(raw["Culture"] ?? raw["culture"]),
      place: str(raw["Country"] ?? raw["country"]),
      nationality: str(raw["Artist Nationality"] ?? raw["artistNationality"])?.split("|")[0] ?? null,
      department: str(raw["Department"] ?? raw["department"]),
    };
  }
  if (institution.includes("Chicago")) {
    return {
      place: str(raw["place_of_origin"]),
      nationality: nationalityIn(raw["artist_display"]),
      department: str(raw["department_title"]),
    };
  }
  if (institution.includes("Cleveland")) {
    return {
      culture: str(raw["culture"]),
      nationality: nationalityIn(raw["creators"]),
      department: `${str(raw["department"]) ?? ""} ${str(raw["collection"]) ?? ""}`,
    };
  }
  return { culture: str(raw["culture"]) };
}

const CASE_WORDS = /\b(album leaf|album|leaf from|folio|manuscript|fan\b|fan painting|page from|miniature)\b/;
const SCROLL_WORDS = /\bhandscroll\b/;

/** Wall, tabletop case, or long scroll case. */
export function displayModeFor(a: {
  title: string;
  medium?: string | null;
  heightCm?: number | null;
  widthCm?: number | null;
  objectType?: ObjectType;
}): DisplayMode {
  const text = fold(`${a.title} ${a.medium ?? ""}`);
  const h = a.heightCm ?? 0;
  const w = a.widthCm ?? 0;
  if (SCROLL_WORDS.test(text) || (w >= 3 * h && w > 100 && h > 0)) return "scroll_case";
  if (a.objectType === "textile") return "wall";
  if (CASE_WORDS.test(text) || (h > 0 && w > 0 && Math.max(h, w) < 25)) return "case";
  return "wall";
}

export type DerivedFields = Pick<NewArtwork, "region" | "period" | "galleryKey" | "searchText" | "displayMode">;

/** All curatorial fields, derived from an artwork and its raw record. */
export function deriveFields(a: NewArtwork): DerivedFields {
  let raw: Record<string, unknown> | null = null;
  try {
    raw = a.rawSourceRecord ? JSON.parse(a.rawSourceRecord) : null;
  } catch {
    raw = null;
  }
  const hints = { ...hintsFromRaw(a.institution, raw), yearStart: a.yearStart ?? null };
  if (!hints.culture) hints.culture = a.culture ?? null;
  const region = classifyRegion(hints);
  const period = periodFor(region, a.yearStart);
  const searchText = fold(
    [a.title, a.artistName, a.medium, a.culture, a.dateDisplay, a.institution, regionLabel(region), period.label, a.classification]
      .filter(Boolean)
      .join(" "),
  ).replace(/\s+/g, " ");
  return {
    region,
    period: period.key,
    galleryKey: galleryKey(region, period.key),
    searchText,
    displayMode: displayModeFor(a),
  };
}
