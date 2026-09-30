import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "@/db";
import { artworks, images } from "@/db/schema";
import { getArtwork, listArtworks } from "./queries";

const OPEN = "https://img.example.org/open.jpg";
const BLOCKED = "https://img.example.org/blocked.jpg";

let db: Db;

beforeEach(async () => {
  db = openDb(":memory:");
  await db.insert(artworks).values([
    { id: 1, title: "Open Work", institution: "Test", sourceRecordId: "1", sourceRecordUrl: "https://t.org/1", yearStart: 1650 },
    { id: 2, title: "Blocked Work", institution: "Test", sourceRecordId: "2", sourceRecordUrl: "https://t.org/2", yearStart: 1950, rawSourceRecord: "{\"secret\":1}" },
  ]);
  const approved = {
    rightsBasis: "CC0" as const,
    displayStatus: "APPROVED" as const,
    rightsEvidenceUrl: "https://t.org/evidence",
    rightsCheckedAt: "2026-09-30T00:00:00Z",
  };
  await db.insert(images).values([
    { artworkId: 1, imageUrl: OPEN, ...approved },
    { artworkId: 2, imageUrl: BLOCKED, ...approved, displayStatus: "WITHDRAWN" },
  ]);
});

describe("public queries", () => {
  it("never returns a blocked image URL anywhere in the payload", async () => {
    const list = await listArtworks(db);
    const detail = await getArtwork(db, 2);
    const payload = JSON.stringify({ list, detail });
    expect(payload).not.toContain(BLOCKED);
    expect(payload).not.toContain("secret");
    expect(detail?.image).toBeNull();
    expect(detail?.title).toBe("Blocked Work");
  });

  it("returns approved images", async () => {
    expect((await getArtwork(db, 1))?.image?.imageUrl).toBe(OPEN);
  });

  it("filters by century, text, and image availability", async () => {
    expect((await listArtworks(db, { century: 17 })).items.map((a) => a.id)).toEqual([1]);
    expect((await listArtworks(db, { q: "blocked" })).items.map((a) => a.id)).toEqual([2]);
    expect((await listArtworks(db, { withImages: true })).total).toBe(1);
  });
});
