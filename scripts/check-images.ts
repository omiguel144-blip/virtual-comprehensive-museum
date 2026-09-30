/**
 * Diagnoses gallery image loading: fetches a few approved images per museum
 * the same way the gallery server does and reports what happened.
 *
 *   npx tsx scripts/check-images.ts
 */
import { and, eq } from "drizzle-orm";
import { openDb } from "../src/db";
import { artworks, images } from "../src/db/schema";
import { fetchApprovedImage } from "../src/lib/fetch-image";
import { isDisplayable } from "../src/lib/rights";

async function main() {
  const db = openDb();
  const rows = db
    .select({ institution: artworks.institution, id: artworks.id, image: images })
    .from(images)
    .innerJoin(artworks, eq(images.artworkId, artworks.id))
    .where(and(eq(images.displayStatus, "APPROVED")))
    .all();

  const byInstitution = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!isDisplayable(row.image)) continue;
    const list = byInstitution.get(row.institution) ?? [];
    if (list.length < 2) list.push(row);
    byInstitution.set(row.institution, list);
  }
  if (byInstitution.size === 0) console.log("No approved images in the database. Run the importers first.");

  for (const [institution, list] of byInstitution) {
    console.log(`\n${institution}`);
    for (const row of list) {
      for (const url of [row.image.thumbnailUrl, row.image.imageUrl]) {
        if (!url) continue;
        const started = Date.now();
        const result = await fetchApprovedImage(url);
        let detail: string;
        if (result.ok) {
          const bytes = (await new Response(result.body).arrayBuffer()).byteLength;
          detail = `OK ${result.contentType} ${(bytes / 1024).toFixed(0)} KB`;
        } else detail = `FAILED ${result.reason}`;
        console.log(`  artwork ${row.id}: ${detail} in ${Date.now() - started} ms\n    ${url}`);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
