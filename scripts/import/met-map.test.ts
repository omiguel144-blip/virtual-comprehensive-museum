import { describe, expect, it } from "vitest";
import { artworkFromCsv, decideImage, isPaintingRow, isTextileRow, type MetObject } from "./met-map";

const obj: MetObject = {
  objectID: 436535,
  isPublicDomain: true,
  primaryImage: "https://images.metmuseum.org/CRDImages/ep/original/DT1567.jpg",
  primaryImageSmall: "https://images.metmuseum.org/CRDImages/ep/web-large/DT1567.jpg",
  title: "Wheat Field with Cypresses",
  artistDisplayName: "Vincent van Gogh",
  objectDate: "1889",
  objectBeginDate: 1889,
  objectEndDate: 1889,
  medium: "Oil on canvas",
  dimensions: "28 7/8 × 36 3/4 in. (73.2 × 93.4 cm)",
  classification: "Paintings",
  culture: "",
  creditLine: "Purchase, The Annenberg Foundation Gift, 1993",
  objectURL: "https://www.metmuseum.org/art/collection/search/436535",
};

describe("decideImage", () => {
  it("approves public-domain objects with a Met-hosted image as CC0", () => {
    const d = decideImage(obj, "2026-09-30T00:00:00Z");
    expect(d.approved).toBe(true);
    expect(d.image).toMatchObject({ rightsBasis: "CC0", displayStatus: "APPROVED" });
  });

  it("blocks non-public-domain objects even when an image URL is present", () => {
    const d = decideImage({ ...obj, isPublicDomain: false }, "now");
    expect(d.approved).toBe(false);
    expect(d.image).toMatchObject({ displayStatus: "BLOCKED", rightsBasis: "UNKNOWN" });
  });

  it("keeps records without images as catalog-only", () => {
    expect(decideImage({ ...obj, primaryImage: "" }, "now")).toMatchObject({ approved: false, image: null });
  });

  it("holds unexpected image hosts for review", () => {
    const d = decideImage({ ...obj, primaryImage: "https://elsewhere.org/a.jpg" }, "now");
    expect(d.image?.displayStatus).toBe("PENDING_REVIEW");
  });
});

describe("CSV mapping", () => {
  const row = {
    "Object ID": "436535",
    Title: "Wheat Field with Cypresses",
    "Artist Display Name": "Vincent van Gogh|Someone Else",
    "Object Date": "1889",
    "Object Begin Date": "1889",
    "Object End Date": "1889",
    Medium: "Oil on canvas",
    Dimensions: "28 7/8 x 36 3/4 in. (73.2 x 93.4 cm)",
    Classification: "Paintings",
    "Link Resource": "http://www.metmuseum.org/art/collection/search/436535",
    "Object Wikidata URL": "https://www.wikidata.org/wiki/Q18393437",
  };

  it("detects paintings and maps fields", () => {
    expect(isPaintingRow(row)).toBe(true);
    expect(isPaintingRow({ Classification: "Coins" })).toBe(false);
    const a = artworkFromCsv(row);
    expect(a).toMatchObject({
      artistName: "Vincent van Gogh",
      yearStart: 1889,
      heightCm: 73.2,
      widthCm: 93.4,
      sourceRecordUrl: "https://www.metmuseum.org/art/collection/search/436535",
      wikidataId: "Q18393437",
    });
  });
});

describe("Met textiles", () => {
  it("imports tapestries and hangings from the Textiles department, not fragments", () => {
    const tapestry = { "Object ID": "1", Classification: "Textiles-Tapestries", "Object Name": "Tapestry", Title: "The Unicorn Defends Itself", Dimensions: "145 x 158 in. (368.3 x 401.3 cm)" };
    expect(isTextileRow(tapestry)).toBe(true);
    expect(artworkFromCsv(tapestry).objectType).toBe("textile");
    expect(isTextileRow({ ...tapestry, "Object Name": "Fragment", Title: "Tapestry fragment" })).toBe(false);
    expect(isTextileRow({ ...tapestry, Classification: "Paintings" })).toBe(false);
  });
});
