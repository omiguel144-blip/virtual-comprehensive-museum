/** Builds an offline test database with one approved and one withdrawn image. */
import fs from "node:fs";
import { openDb } from "../src/db";
import { artworks, images } from "../src/db/schema";

export const E2E_DB = "data/e2e.db";
export const OPEN_URL = "https://images.example.org/open-full.jpg";
export const OPEN_THUMB = "https://images.example.org/open-small.jpg";
export const BLOCKED_URL = "https://images.example.org/withdrawn-full.jpg";
export const BLOCKED_THUMB = "https://images.example.org/withdrawn-small.jpg";

export function buildFixture() {
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(E2E_DB + suffix, { force: true });
  const db = openDb(E2E_DB);
  const approved = {
    rightsBasis: "CC0" as const,
    displayStatus: "APPROVED" as const,
    rightsEvidenceUrl: "https://museum.example.org/evidence",
    rightsCheckedAt: "2026-09-30T00:00:00Z",
  };
  db.insert(artworks)
    .values([
      { id: 1, title: "Open Landscape", artistName: "Test Painter", yearStart: 1650, heightCm: 91.5, widthCm: 151.8, dimensionConfidence: "measured" as const, institution: "Example Museum", sourceRecordId: "1", sourceRecordUrl: "https://museum.example.org/1" },
      { id: 2, title: "Withdrawn Portrait", artistName: "Test Painter", yearStart: 1650, heightCm: 80, widthCm: 60, dimensionConfidence: "measured" as const, institution: "Example Museum", sourceRecordId: "2", sourceRecordUrl: "https://museum.example.org/2" },
    ])
    .run();
  db.insert(images)
    .values([
      { artworkId: 1, imageUrl: OPEN_URL, thumbnailUrl: OPEN_THUMB, ...approved },
      { artworkId: 2, imageUrl: BLOCKED_URL, thumbnailUrl: BLOCKED_THUMB, ...approved, displayStatus: "WITHDRAWN", manualOverride: true },
    ])
    .run();
}

if (process.argv[1]?.endsWith("fixture.ts")) buildFixture();
