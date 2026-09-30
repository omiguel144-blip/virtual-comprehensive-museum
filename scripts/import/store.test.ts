import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { openDb } from "../../src/db";
import { images } from "../../src/db/schema";
import { upsertArtwork, upsertImage } from "./store";

const artwork = { title: "A", institution: "T", sourceRecordId: "1", sourceRecordUrl: "https://t.org/1" };
const image = {
  imageUrl: "https://img.t.org/a.jpg",
  rightsBasis: "CC0" as const,
  displayStatus: "APPROVED" as const,
  rightsEvidenceUrl: "https://t.org/1",
  rightsCheckedAt: "now",
};

describe("import store", () => {
  it("upserts artworks by institution and source id", () => {
    const db = openDb(":memory:");
    const first = upsertArtwork(db, artwork);
    const second = upsertArtwork(db, { ...artwork, title: "B" });
    expect(second).toBe(first);
  });

  it("never overwrites an image a human withdrew", () => {
    const db = openDb(":memory:");
    const id = upsertArtwork(db, artwork);
    expect(upsertImage(db, id, image)).toBe(true);
    db.update(images).set({ displayStatus: "WITHDRAWN", manualOverride: true }).run();

    expect(upsertImage(db, id, image)).toBe(false);
    const rows = db.select().from(images).where(eq(images.artworkId, id)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].displayStatus).toBe("WITHDRAWN");
  });
});
