import { describe, expect, it } from "vitest";
import { aicImageUrl, artworkFromAic, decideAicImage, decideAicVerification, isAicPainting, type AicArtwork } from "./aic-map";

const record: AicArtwork = {
  id: 100026,
  title: "Studies of Pierre Renoir",
  artist_title: "Pierre-Auguste Renoir",
  artist_display: "Pierre-Auguste Renoir (French, 1841–1919)",
  date_display: "1885–86",
  date_start: 1885,
  date_end: 1886,
  medium_display: "Oil on canvas",
  dimensions: "45.8 × 39 cm (18 × 15 3/8 in.); Framed: 68.6 × 61 cm (27 × 24 in.)",
  artwork_type_title: "Painting",
  classification_title: "painting",
  place_of_origin: "France",
  credit_line: "Purchased with funds provided by the Phillips Family Collection",
  is_public_domain: true,
  copyright_notice: null,
  image_id: "bda9058b-5be6-37d0-e5a6-926584540757",
  thumbnail: { width: 1902, height: 2250 },
  timestamp: "2025-02-16T01:08:25-06:00",
};

describe("AIC mapping", () => {
  it("maps fields and the unframed size", () => {
    expect(isAicPainting(record)).toBe(true);
    expect(artworkFromAic(record)).toMatchObject({
      artistName: "Pierre-Auguste Renoir",
      yearStart: 1885,
      yearEnd: 1886,
      heightCm: 45.8,
      widthCm: 39,
      dimensionConfidence: "measured",
      sourceRecordUrl: "https://www.artic.edu/artworks/100026",
    });
  });

  it("approves public-domain works with IIIF URLs and the dump timestamp as check date", () => {
    const d = decideAicImage(record, "now");
    expect(d.approved).toBe(true);
    expect(d.image).toMatchObject({
      imageUrl: "https://www.artic.edu/iiif/2/bda9058b-5be6-37d0-e5a6-926584540757/full/1686,/0/default.jpg",
      thumbnailUrl: "https://www.artic.edu/iiif/2/bda9058b-5be6-37d0-e5a6-926584540757/full/843,/0/default.jpg",
      rightsBasis: "CC0",
      rightsCheckedAt: "2025-02-16T01:08:25-06:00",
    });
  });

  it("stores no image for copyrighted works even though IIIF would serve one", () => {
    expect(decideAicImage({ ...record, is_public_domain: false }, "now")).toMatchObject({ approved: false, image: null });
  });

  it("keeps records without an image_id catalog-only", () => {
    expect(decideAicImage({ ...record, image_id: null }, "now")).toMatchObject({ approved: false, image: null });
  });

  it("holds conflicting rights for review", () => {
    const d = decideAicImage({ ...record, copyright_notice: "© Estate of the artist" }, "now");
    expect(d.approved).toBe(false);
    expect(d.image).toMatchObject({ displayStatus: "PENDING_REVIEW", rightsBasis: "UNKNOWN" });
  });
});

describe("aicImageUrl", () => {
  it("never asks the IIIF server to upscale", () => {
    expect(aicImageUrl("x", 843, 420)).toBe("https://www.artic.edu/iiif/2/x/full/420,/0/default.jpg");
    expect(aicImageUrl("x", 1686, 2000)).toBe("https://www.artic.edu/iiif/2/x/full/1686,/0/default.jpg");
    expect(aicImageUrl("x", 843, null)).toBe("https://www.artic.edu/iiif/2/x/full/843,/0/default.jpg");
  });

  it("caps narrow images at import time", () => {
    const d = decideAicImage({ ...record, thumbnail: { width: 240, height: 768 } }, "now");
    expect(d.image).toMatchObject({
      imageUrl: expect.stringContaining("/full/240,/"),
      thumbnailUrl: expect.stringContaining("/full/240,/"),
    });
  });
});

describe("decideAicVerification", () => {
  const stored = {
    imageUrl: "https://www.artic.edu/iiif/2/abc/full/1686,/0/default.jpg",
    thumbnailUrl: "https://www.artic.edu/iiif/2/abc/full/843,/0/default.jpg",
    pixelWidth: 2000,
    pixelHeight: 1500,
  };
  const live = { id: 1, is_public_domain: true, image_id: "abc", copyright_notice: null };

  it("confirms unchanged public-domain images", () => {
    expect(decideAicVerification(stored, live)).toEqual({ action: "confirm" });
  });

  it("updates URLs when AIC replaced the image", () => {
    expect(decideAicVerification(stored, { ...live, image_id: "xyz" })).toEqual({
      action: "update",
      imageUrl: "https://www.artic.edu/iiif/2/xyz/full/1686,/0/default.jpg",
      thumbnailUrl: "https://www.artic.edu/iiif/2/xyz/full/843,/0/default.jpg",
      pixelWidth: 2000,
      pixelHeight: 1500,
    });
  });

  it("fixes stored URLs that ask a narrow image to upscale", () => {
    const d = decideAicVerification(stored, { ...live, thumbnail: { width: 420, height: 768 } });
    expect(d).toMatchObject({
      action: "update",
      imageUrl: "https://www.artic.edu/iiif/2/abc/full/420,/0/default.jpg",
      thumbnailUrl: "https://www.artic.edu/iiif/2/abc/full/420,/0/default.jpg",
      pixelWidth: 420,
    });
  });

  it("blocks when the live record is no longer clearly open access", () => {
    expect(decideAicVerification(stored, undefined)).toMatchObject({ action: "block" });
    expect(decideAicVerification(stored, { ...live, is_public_domain: false })).toMatchObject({ action: "block" });
    expect(decideAicVerification(stored, { ...live, copyright_notice: "© Estate" })).toMatchObject({ action: "block" });
    expect(decideAicVerification(stored, { ...live, image_id: null })).toMatchObject({ action: "block" });
  });
});
