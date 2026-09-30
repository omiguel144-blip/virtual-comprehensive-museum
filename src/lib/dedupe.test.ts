import { describe, expect, it } from "vitest";
import { findCandidates, parseWikidataId, pickCanonical, titleSimilarity, type DedupeRecord } from "./dedupe";

const base: DedupeRecord = {
  id: 1,
  institution: "Museum A",
  title: "The Harvesters",
  artistName: "Pieter Bruegel the Elder",
  yearStart: 1565,
  heightCm: 116.5,
  widthCm: 159.5,
  wikidataId: null,
};

describe("parseWikidataId", () => {
  it("reads IDs from URLs and CMA's resource strings", () => {
    expect(parseWikidataId("https://www.wikidata.org/wiki/Q87480807")).toBe("Q87480807");
    expect(parseWikidataId("{'wikidata': ['https://www.wikidata.org/wiki/Q123'], 'internet_archive': []}")).toBe("Q123");
    expect(parseWikidataId("q42")).toBe("Q42");
    expect(parseWikidataId("")).toBeNull();
    expect(parseWikidataId(null)).toBeNull();
  });
});

describe("titleSimilarity", () => {
  it("ignores accents, punctuation, stopwords, and the Met's original-language prefix", () => {
    expect(titleSimilarity("The Harvesters", "Harvesters")).toBe(1);
    expect(titleSimilarity("明 佚名 山水圖|Landscape", "Landscape")).toBe(1);
    expect(titleSimilarity("Café à Arles", "Cafe, Arles")).toBe(1);
    expect(titleSimilarity("Stack of Wheat", "Gardener's House at Antibes")).toBe(0);
  });
});

describe("findCandidates", () => {
  it("auto-merges only on a shared Wikidata ID", () => {
    const [c] = findCandidates([
      { ...base, wikidataId: "Q1" },
      { ...base, id: 2, institution: "Aggregator", title: "Something else", wikidataId: "Q1" },
    ]);
    expect(c).toMatchObject({ artworkA: 1, artworkB: 2, auto: true });
  });

  it("proposes close fuzzy matches across museums for review, never auto", () => {
    const [c] = findCandidates([base, { ...base, id: 2, institution: "Museum B", title: "Harvesters", heightCm: 117 }]);
    expect(c).toMatchObject({ auto: false });
  });

  it("ignores same-museum pairs, different titles, sizes, or years", () => {
    const other = { ...base, id: 2, institution: "Museum B" };
    expect(findCandidates([base, { ...base, id: 2 }])).toEqual([]);
    expect(findCandidates([base, { ...other, title: "Hunters in the Snow" }])).toEqual([]);
    expect(findCandidates([base, { ...other, widthCm: 170 }])).toEqual([]);
    expect(findCandidates([base, { ...other, yearStart: 1570 }])).toEqual([]);
  });

  it("does not match works by unknown artists", () => {
    const anon = { ...base, artistName: "Unknown" };
    expect(findCandidates([anon, { ...anon, id: 2, institution: "Museum B" }])).toEqual([]);
  });
});

describe("pickCanonical", () => {
  it("keeps the record with an approved image, then a measured size, then the older id", () => {
    expect(pickCanonical({ id: 1, hasApprovedImage: false, measured: true }, { id: 2, hasApprovedImage: true, measured: false })).toEqual({ keep: 2, hide: 1 });
    expect(pickCanonical({ id: 5, hasApprovedImage: true, measured: false }, { id: 2, hasApprovedImage: true, measured: true })).toEqual({ keep: 2, hide: 5 });
    expect(pickCanonical({ id: 3, hasApprovedImage: true, measured: true }, { id: 4, hasApprovedImage: true, measured: true })).toEqual({ keep: 3, hide: 4 });
  });
});
