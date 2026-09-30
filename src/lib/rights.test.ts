import { describe, expect, it } from "vitest";
import { checkImage, getDisplayImage } from "./rights";
import type { Image } from "@/db/schema";

const base: Image = {
  id: 1,
  artworkId: 1,
  imageUrl: "https://images.example.org/full.jpg",
  thumbnailUrl: "https://images.example.org/small.jpg",
  pixelWidth: 4000,
  pixelHeight: 3000,
  rightsBasis: "CC0",
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  rightsStatement: "Public domain",
  attributionText: null,
  rightsEvidenceUrl: "https://museum.example.org/object/1",
  rightsCheckedAt: "2026-09-30T00:00:00Z",
  displayStatus: "APPROVED",
  manualOverride: false,
  createdAt: "",
  updatedAt: "",
};

describe("checkImage", () => {
  it("approves CC0 and public domain images that are approved with evidence", () => {
    expect(checkImage(base).ok).toBe(true);
    expect(checkImage({ ...base, rightsBasis: "PUBLIC_DOMAIN" }).ok).toBe(true);
  });

  it.each(["BLOCKED", "PENDING_REVIEW", "WITHDRAWN"] as const)(
    "rejects status %s regardless of rights basis",
    (status) => {
      expect(checkImage({ ...base, displayStatus: status }).ok).toBe(false);
    },
  );

  it("never approves unknown rights, even when marked approved", () => {
    expect(checkImage({ ...base, rightsBasis: "UNKNOWN" }).ok).toBe(false);
  });

  it("requires attribution and a license URL for CC BY", () => {
    const ccby = { ...base, rightsBasis: "CC_BY" as const };
    expect(checkImage(ccby).ok).toBe(false);
    expect(checkImage({ ...ccby, attributionText: "Photo: Museum" }).ok).toBe(true);
    expect(checkImage({ ...ccby, attributionText: "Photo: Museum", licenseUrl: null }).ok).toBe(false);
  });

  it("requires rights evidence and a check date", () => {
    expect(checkImage({ ...base, rightsEvidenceUrl: null }).ok).toBe(false);
    expect(checkImage({ ...base, rightsCheckedAt: null }).ok).toBe(false);
  });

  it("rejects non-https image URLs", () => {
    expect(checkImage({ ...base, imageUrl: "http://x.org/a.jpg" }).ok).toBe(false);
    expect(checkImage({ ...base, imageUrl: "javascript:alert(1)" }).ok).toBe(false);
  });
});

describe("getDisplayImage", () => {
  it("returns null when no image passes", () => {
    expect(getDisplayImage([{ ...base, displayStatus: "BLOCKED" }])).toBeNull();
    expect(getDisplayImage([])).toBeNull();
  });

  it("skips blocked images and returns the first approved one", () => {
    const blocked = { ...base, id: 2, imageUrl: "https://x.org/blocked.jpg", displayStatus: "BLOCKED" as const };
    const result = getDisplayImage([blocked, base]);
    expect(result?.imageUrl).toBe(base.imageUrl);
  });

  it("falls back to the full image when the thumbnail is missing", () => {
    expect(getDisplayImage([{ ...base, thumbnailUrl: null }])?.thumbnailUrl).toBe(base.imageUrl);
  });
});
