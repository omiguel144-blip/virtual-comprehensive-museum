import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { openDb } from "../../src/db";
import { images } from "../../src/db/schema";
import { AIC_INSTITUTION } from "./aic-map";
import { newVerifyReport, verifyAicImages } from "./aic-verify-core";
import { upsertArtwork, upsertImage } from "./store";

const url = (id: string) => `https://www.artic.edu/iiif/2/${id}/full/1686,/0/default.jpg`;

function setup() {
  const db = openDb(":memory:");
  const ids: Record<string, number> = {};
  for (const [source, imageId, extra] of [
    ["1", "same", {}],
    ["2", "old", {}],
    ["3", "gone", {}],
    ["4", "notpd", {}],
    ["5", "takedown", { displayStatus: "WITHDRAWN" as const, manualOverride: true }],
  ] as const) {
    const artworkId = upsertArtwork(db, {
      title: `Work ${source}`,
      institution: AIC_INSTITUTION,
      sourceRecordId: source,
      sourceRecordUrl: `https://www.artic.edu/artworks/${source}`,
    });
    upsertImage(db, artworkId, {
      imageUrl: url(imageId),
      thumbnailUrl: url(imageId).replace("1686", "843"),
      rightsBasis: "CC0",
      displayStatus: "APPROVED",
      rightsEvidenceUrl: "https://api.artic.edu",
      rightsCheckedAt: "2025-02-16",
      ...extra,
    });
    ids[source] = artworkId;
  }
  return { db, ids };
}

describe("verifyAicImages", () => {
  it("confirms, updates, and blocks based on the live record, and skips takedowns", async () => {
    const { db, ids } = setup();
    const report = newVerifyReport();
    const requested: string[][] = [];
    await verifyAicImages(
      db,
      async (batch) => {
        requested.push(batch);
        return [
          { id: 1, is_public_domain: true, image_id: "same", copyright_notice: null },
          { id: 2, is_public_domain: true, image_id: "new", copyright_notice: null },
          { id: 4, is_public_domain: false, image_id: "notpd", copyright_notice: null },
          // 3 is missing from the API; 5 is never asked about.
        ];
      },
      report,
      { pauseMs: 0 },
    );

    const get = (source: string) => db.select().from(images).where(eq(images.artworkId, ids[source])).get()!;
    expect(requested).toEqual([["1", "2", "3", "4"]]);
    expect(get("1")).toMatchObject({ displayStatus: "APPROVED", imageUrl: url("same") });
    expect(get("1").rightsCheckedAt).not.toBe("2025-02-16");
    expect(get("2")).toMatchObject({ displayStatus: "APPROVED", imageUrl: url("new") });
    expect(get("3").displayStatus).toBe("BLOCKED");
    expect(get("4").displayStatus).toBe("BLOCKED");
    expect(get("5")).toMatchObject({ displayStatus: "WITHDRAWN", manualOverride: true, rightsCheckedAt: "2025-02-16" });
    expect(report).toMatchObject({ checked: 4, confirmed: 1, updated: 1, blocked: 2 });
  });

  it("leaves a batch untouched when the request fails", async () => {
    const { db, ids } = setup();
    const report = newVerifyReport();
    await verifyAicImages(db, async () => Promise.reject(new Error("HTTP 503")), report, { pauseMs: 0 });
    const row = db.select().from(images).where(eq(images.artworkId, ids["1"])).get()!;
    expect(row).toMatchObject({ displayStatus: "APPROVED", rightsCheckedAt: "2025-02-16" });
    expect(report.errors).toHaveLength(1);
  });
});
