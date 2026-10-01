/**
 * Recomputes region, period, gallery, search text and display mode for every
 * artwork from its stored source record. Fast and local; safe to rerun.
 *
 *   npx tsx scripts/classify.ts
 */
import { eq } from "drizzle-orm";
import { openDb } from "../src/db";
import { artworks } from "../src/db/schema";
import { deriveFields } from "../src/lib/classify";
import { regionLabel } from "../src/lib/regions";

const db = openDb();
const rows = db.select().from(artworks).all();
const counts = new Map<string, number>();
db.transaction((tx) => {
  for (const row of rows) {
    const derived = deriveFields(row);
    tx.update(artworks).set(derived).where(eq(artworks.id, row.id)).run();
    counts.set(derived.region!, (counts.get(derived.region!) ?? 0) + 1);
  }
});
console.log(`Classified ${rows.length} artworks:`);
for (const [region, n] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`  ${regionLabel(region).padEnd(36)} ${n}`);
