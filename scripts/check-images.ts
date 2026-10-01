/**
 * Diagnoses gallery image loading: fetches a few approved images per museum
 * the same way the gallery server does and reports what happened.
 *
 *   npx tsx scripts/check-images.ts                     two works per museum
 *   npx tsx scripts/check-images.ts --ids 3049,1403     specific artwork ids (from the dev log)
 *   npx tsx scripts/check-images.ts --institution "Art Institute of Chicago" --all
 */
import { and, eq, inArray } from "drizzle-orm";
import { openDb } from "../src/db";
import { artworks, images } from "../src/db/schema";
import { fetchApprovedImage } from "../src/lib/fetch-image";
import { isDisplayable } from "../src/lib/rights";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const db = openDb();
  const ids = arg("ids")?.split(",").map(Number).filter(Number.isInteger);
  const institution = arg("institution");
  const all = process.argv.includes("--all");

  const rows = db
    .select({ institution: artworks.institution, id: artworks.id, image: images })
    .from(images)
    .innerJoin(artworks, eq(images.artworkId, artworks.id))
    .where(
      and(
        ids?.length ? inArray(artworks.id, ids) : eq(images.displayStatus, "APPROVED"),
        institution ? eq(artworks.institution, institution) : undefined,
      ),
    )
    .all();

  const byInstitution = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!isDisplayable(row.image)) {
      // Explicitly requested works get an explanation instead of silence.
      if (ids?.length) console.log(`artwork ${row.id}: not displayable (status ${row.image.displayStatus}); the gallery won't request it`);
      continue;
    }
    const list = byInstitution.get(row.institution) ?? [];
    if (all || ids?.length || list.length < 2) list.push(row);
    byInstitution.set(row.institution, list);
  }
  if (byInstitution.size === 0 && !ids?.length) console.log("No approved images match. Run the importers first.");

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
