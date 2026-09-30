/**
 * Pure duplicate detection across collections. Strong evidence (a shared
 * Wikidata ID) is merged automatically; everything else only becomes a
 * candidate for human review.
 */

export type DedupeRecord = {
  id: number;
  institution: string;
  title: string;
  artistName: string | null;
  yearStart: number | null;
  heightCm: number | null;
  widthCm: number | null;
  wikidataId: string | null;
};

export type Candidate = {
  artworkA: number;
  artworkB: number;
  reason: string;
  score: number;
  /** True only for strong evidence that may be merged without review. */
  auto: boolean;
};

export const TITLE_THRESHOLD = 0.8;
export const YEAR_TOLERANCE = 2;
export const SIZE_TOLERANCE = 0.03;

/** Extracts "Q123" from a Wikidata URL or free text. */
export function parseWikidataId(value: string | null | undefined): string | null {
  const match = value?.match(/wikidata\.org\/(?:wiki|entity)\/(Q\d+)/i) ?? value?.match(/^\s*(Q\d+)\s*$/i);
  return match ? match[1].toUpperCase() : null;
}

const STOPWORDS = new Set(["the", "a", "an", "of", "and", "in", "with", "at", "on", "le", "la", "les", "de", "du", "des"]);

export function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Met titles may be "<original>|<English>"; compare the English part. */
export function titleTokens(title: string): Set<string> {
  const english = title.includes("|") ? title.slice(title.lastIndexOf("|") + 1) : title;
  return new Set(normalize(english).split(" ").filter((t) => t && !STOPWORDS.has(t)));
}

export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

const withinRatio = (a: number, b: number, tolerance: number) => Math.abs(a - b) / Math.max(a, b) <= tolerance;

const UNKNOWN_ARTIST = /^(unknown|anonymous|unidentified|artist unknown)$/;

/** Returns candidate pairs, strongest evidence first. */
export function findCandidates(records: DedupeRecord[]): Candidate[] {
  const out = new Map<string, Candidate>();
  const add = (x: DedupeRecord, y: DedupeRecord, c: Omit<Candidate, "artworkA" | "artworkB">) => {
    const [a, b] = x.id < y.id ? [x.id, y.id] : [y.id, x.id];
    const key = `${a}-${b}`;
    const existing = out.get(key);
    if (!existing || (c.auto && !existing.auto) || c.score > existing.score) out.set(key, { artworkA: a, artworkB: b, ...c });
  };

  // 1. Shared Wikidata ID: the same object recorded twice.
  const byWikidata = new Map<string, DedupeRecord[]>();
  for (const r of records) {
    if (!r.wikidataId) continue;
    const list = byWikidata.get(r.wikidataId) ?? [];
    list.push(r);
    byWikidata.set(r.wikidataId, list);
  }
  for (const [qid, list] of byWikidata) {
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) add(list[i], list[j], { reason: `same Wikidata ID ${qid}`, score: 1, auto: true });
  }

  // 2. Fuzzy: same artist, similar title, close year, matching size. Review only.
  const byArtist = new Map<string, DedupeRecord[]>();
  for (const r of records) {
    const artist = normalize(r.artistName);
    if (!artist || UNKNOWN_ARTIST.test(artist)) continue;
    const list = byArtist.get(artist) ?? [];
    list.push(r);
    byArtist.set(artist, list);
  }
  for (const list of byArtist.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const x = list[i];
        const y = list[j];
        // Within one museum, separate records are separate objects (series, pendants, album leaves).
        if (x.institution === y.institution) continue;
        if (x.yearStart === null || y.yearStart === null || Math.abs(x.yearStart - y.yearStart) > YEAR_TOLERANCE) continue;
        if (!x.heightCm || !y.heightCm || !x.widthCm || !y.widthCm) continue;
        if (!withinRatio(x.heightCm, y.heightCm, SIZE_TOLERANCE) || !withinRatio(x.widthCm, y.widthCm, SIZE_TOLERANCE)) continue;
        const similarity = titleSimilarity(x.title, y.title);
        if (similarity < TITLE_THRESHOLD) continue;
        add(x, y, {
          reason: `same artist, title ${(similarity * 100).toFixed(0)}% similar, years and size match`,
          score: Math.round(similarity * 100) / 100,
          auto: false,
        });
      }
    }
  }

  return [...out.values()].sort((a, b) => Number(b.auto) - Number(a.auto) || b.score - a.score);
}

export type CanonicalInput = { id: number; hasApprovedImage: boolean; measured: boolean };

/** Picks which record stays visible: approved image, then measured size, then oldest. */
export function pickCanonical(a: CanonicalInput, b: CanonicalInput): { keep: number; hide: number } {
  const rank = (r: CanonicalInput) => (r.hasApprovedImage ? 2 : 0) + (r.measured ? 1 : 0);
  const keepA = rank(a) > rank(b) || (rank(a) === rank(b) && a.id < b.id);
  return keepA ? { keep: a.id, hide: b.id } : { keep: b.id, hide: a.id };
}
