import { beforeEach, describe, expect, it } from "vitest";
import { backfillDerived, openDb, type Db } from "@/db";
import { eq } from "drizzle-orm";
import { artworks, images } from "@/db/schema";
import { getArtwork, getRelatedRecords, listArtworks, listGalleries, listGalleryArtworks, searchWords } from "./queries";

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
  backfillDerived(db);
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

  it("gallery only includes approved images with measured sizes", async () => {
    await db.update(artworks).set({ heightCm: 50, widthCm: 40, dimensionConfidence: "measured" });
    const key = (await getArtwork(db, 1))!.galleryKey!;
    const gallery = await listGalleryArtworks(db, { galleryKey: key });
    expect(gallery.items.map((a) => a.id)).toEqual([1]);
    expect(JSON.stringify(gallery)).not.toContain(BLOCKED);
    const search = await listGalleryArtworks(db, { q: "work" });
    expect(search.items.map((a) => a.id)).toEqual([1]);
    expect(JSON.stringify(search)).not.toContain(BLOCKED);
    const galleries = await listGalleries(db);
    expect(galleries.map((g) => g.coverId)).toEqual([1]);

    await db.update(artworks).set({ dimensionConfidence: "estimated" });
    expect((await listGalleryArtworks(db, { galleryKey: key })).items).toEqual([]);
    expect(await listGalleries(db)).toEqual([]);
  });

  it("hides confirmed duplicates from lists but links them from the kept record", async () => {
    await db.update(artworks).set({ duplicateOf: 1 }).where(eq(artworks.id, 2));
    expect((await listArtworks(db)).items.map((a) => a.id)).toEqual([1]);
    const kept = (await getArtwork(db, 1))!;
    expect((await getRelatedRecords(db, kept)).map((r) => r.id)).toEqual([2]);
    const hidden = (await getArtwork(db, 2))!;
    expect(hidden.duplicateOf).toBe(1);
    expect((await getRelatedRecords(db, hidden)).map((r) => r.id)).toEqual([1]);
  });

  it("matches every word, in any field, ignoring accents and case", async () => {
    await db.update(artworks).set({ title: "Crucifixión of Saint Andrew", artistName: "Caravaggio", galleryKey: null }).where(eq(artworks.id, 1));
    backfillDerived(db);
    const ids = async (q: string) => (await listArtworks(db, { q })).items.map((a) => a.id);
    expect(await ids("caravaggio")).toEqual([1]);
    expect(await ids("Caravaggio saint")).toEqual([1]);
    expect(await ids("crucifixion")).toEqual([1]);
    expect(await ids("caravaggio portrait")).toEqual([]);
  });

  it("escapes LIKE wildcards in queries", () => {
    expect(searchWords("100% _test_ Café")).toEqual(["100", "test", "cafe"]);
    expect(searchWords("")).toEqual([]);
  });
});
