import { describe, expect, it } from "vitest";
import { artworkFromCma, cmaArtistName, decideCmaImage, isCmaPainting } from "./cma-map";

const row = {
  id: "74228",
  accession_number: "2020.113",
  share_license_status: "CC0",
  title: "Fishmarket",
  creation_date: "1902",
  creation_date_earliest: "1902",
  creation_date_latest: "1902",
  culture: "France, 20th century",
  technique: "oil on canvas",
  type: "Painting",
  measurements: "Unframed: 66 x 81.3 cm (26 x 32 in.)",
  copyright: "",
  url: "https://clevelandart.org/art/2020.113",
  creditline: "Nancy F. and Joseph P. Keithley Collection Gift",
  image_credit: "",
  external_resources: "{'wikidata': ['https://www.wikidata.org/wiki/Q87480807'], 'internet_archive': []}",
  creators: "Camille Pissarro (French, 1830–1903), artist",
  image_web: "https://openaccess-cdn.clevelandart.org/2020.113/2020.113_web.jpg",
  image_print: "https://openaccess-cdn.clevelandart.org/2020.113/2020.113_print.jpg",
  image_full: "https://openaccess-cdn.clevelandart.org/2020.113/2020.113_full.tif",
};

describe("CMA mapping", () => {
  it("maps fields and the unframed size", () => {
    expect(isCmaPainting(row)).toBe(true);
    expect(artworkFromCma(row)).toMatchObject({
      artistName: "Camille Pissarro",
      yearStart: 1902,
      heightCm: 66,
      widthCm: 81.3,
      dimensionConfidence: "measured",
      sourceRecordId: "74228",
      wikidataId: "Q87480807",
    });
  });

  it("parses creator strings", () => {
    expect(cmaArtistName("Workshop of Rogier van der Weyden (Flemish), workshop; Someone")).toBe(
      "Workshop of Rogier van der Weyden",
    );
    expect(cmaArtistName("")).toBeNull();
  });

  it("approves CC0 works with CDN images, using the print size for detail pages", () => {
    const d = decideCmaImage(row, "now");
    expect(d.approved).toBe(true);
    expect(d.image).toMatchObject({ imageUrl: row.image_print, thumbnailUrl: row.image_web, rightsBasis: "CC0" });
  });

  it("stores no image for copyrighted works", () => {
    expect(decideCmaImage({ ...row, share_license_status: "Copyrighted" }, "now")).toMatchObject({
      approved: false,
      image: null,
    });
  });

  it("holds conflicting rights and unexpected hosts for review", () => {
    expect(decideCmaImage({ ...row, copyright: "© ARS" }, "now").image?.displayStatus).toBe("PENDING_REVIEW");
    expect(decideCmaImage({ ...row, image_web: "https://elsewhere.org/a.jpg" }, "now").image?.displayStatus).toBe(
      "PENDING_REVIEW",
    );
  });
});
