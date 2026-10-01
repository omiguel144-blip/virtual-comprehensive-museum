import { describe, expect, it } from "vitest";
import { deriveFields, displayModeFor, hintsFromRaw } from "./classify";

describe("hintsFromRaw", () => {
  it("reads each museum's fields", () => {
    expect(hintsFromRaw("The Metropolitan Museum of Art", { Culture: "", "Artist Nationality": "Italian|French", Department: "European Paintings" })).toMatchObject({ nationality: "Italian", department: "European Paintings" });
    expect(hintsFromRaw("Art Institute of Chicago", { place_of_origin: "France", artist_display: "Pierre-Auguste Renoir (French, 1841–1919)" })).toMatchObject({ place: "France", nationality: "French" });
    expect(hintsFromRaw("Art Institute of Chicago", { artist_display: "Andy Warhol\nAmerican, 1928-1987" }).nationality).toBe("American, 1928-1987");
    expect(hintsFromRaw("Cleveland Museum of Art", { culture: "France", creators: "Camille Pissarro (French, 1830–1903), artist" })).toMatchObject({ culture: "France", nationality: "French" });
  });
});

describe("displayModeFor", () => {
  it("puts handscrolls and very long works in a scroll case", () => {
    expect(displayModeFor({ title: "Landscape, handscroll", heightCm: 30, widthCm: 500 })).toBe("scroll_case");
    expect(displayModeFor({ title: "River View", heightCm: 30, widthCm: 400 })).toBe("scroll_case");
  });

  it("puts album leaves, manuscript pages and small works in a case", () => {
    expect(displayModeFor({ title: "Album leaf: Bamboo", heightCm: 30, widthCm: 30 })).toBe("case");
    expect(displayModeFor({ title: "Folio from a Shahnama", heightCm: 40, widthCm: 30 })).toBe("case");
    expect(displayModeFor({ title: "Portrait", heightCm: 20, widthCm: 15 })).toBe("case");
  });

  it("hangs ordinary paintings and textiles on the wall", () => {
    expect(displayModeFor({ title: "The Harvesters", heightCm: 116, widthCm: 159 })).toBe("wall");
    expect(displayModeFor({ title: "Tapestry", heightCm: 300, widthCm: 1000, objectType: "textile" })).toBe("scroll_case");
    expect(displayModeFor({ title: "Tapestry", heightCm: 300, widthCm: 500, objectType: "textile" })).toBe("wall");
  });
});

describe("deriveFields", () => {
  it("derives region, period, gallery and accent-folded search text", () => {
    const d = deriveFields({
      title: "The Crucifixion of Saint Andrew",
      artistName: "Caravaggio (Michelangelo Merisi)",
      medium: "Oil on canvas",
      yearStart: 1606,
      institution: "Cleveland Museum of Art",
      sourceRecordId: "1",
      sourceRecordUrl: "https://x",
      rawSourceRecord: JSON.stringify({ culture: "Italy", creators: "Caravaggio (Italian, 1571–1610), artist" }),
    });
    expect(d).toMatchObject({ region: "italy", period: "1600", galleryKey: "italy:1600", displayMode: "wall" });
    expect(d.searchText).toContain("caravaggio");
    expect(d.searchText).toContain("17th century");
  });

  it("folds accents for search", () => {
    const d = deriveFields({ title: "Café à Arles", institution: "T", sourceRecordId: "1", sourceRecordUrl: "x" });
    expect(d.searchText).toContain("cafe a arles");
  });
});
