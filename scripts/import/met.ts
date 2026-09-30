/**
 * Imports paintings from The Met.
 *
 *   npx tsx scripts/import/met.ts [--limit N] [--ids 1,2,3] [--rate 4] [--catalog-only] [--csv path]
 *
 * Stage 1 reads MetObjects.csv (downloaded once to data/) and stores every
 * painting as a catalog record, with no images.
 * Stage 2 asks the Met object API for public-domain candidates and stores
 * an image only when the object record says isPublicDomain with a primaryImage.
 * Never uses the retiring v1 search endpoint.
 */
import { parse } from "csv-parse";
import fs from "node:fs";
import path from "node:path";
import { eq, and } from "drizzle-orm";
import { openDb } from "../../src/db";
import { artworks } from "../../src/db/schema";
import {
  MET_API,
  MET_INSTITUTION,
  artworkFromApi,
  artworkFromCsv,
  decideImage,
  isPaintingRow,
  type MetCsvRow,
  type MetObject,
} from "./met-map";
import { blockImages, upsertArtwork, upsertImage } from "./store";
import { downloadOnce } from "./common";

const CSV_URL = "https://media.githubusercontent.com/media/metmuseum/openaccess/master/MetObjects.csv";
const USER_AGENT = "virtual-comprehensive-museum/0.1 (open-access research project)";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const limit = arg("limit") ? Number(arg("limit")) : Infinity;
const ids = arg("ids")?.split(",").map((s) => s.trim()).filter(Boolean);
const rate = Number(arg("rate") ?? 4); // requests per second; the Met allows 80, we stay far below
const catalogOnly = flag("catalog-only");
const csvPath = arg("csv") ?? path.join(process.cwd(), "data", "MetObjects.csv");

const report = {
  source: MET_INSTITUTION,
  startedAt: new Date().toISOString(),
  finishedAt: "",
  csvRowsScanned: 0,
  paintingRecords: 0,
  publicDomainCandidates: 0,
  apiRequests: 0,
  imagesApproved: 0,
  catalogOnly: 0,
  skippedManualOverride: 0,
  rejected: {} as Record<string, number>,
  errors: [] as string[],
};

const reject = (reason: string) => {
  report.rejected[reason] = (report.rejected[reason] ?? 0) + 1;
  report.catalogOnly++;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchObject(id: string, attempt = 1): Promise<MetObject | null> {
  report.apiRequests++;
  const res = await fetch(`${MET_API}/objects/${id}`, { headers: { "User-Agent": USER_AGENT } });
  if (res.status === 404) return null;
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    await sleep(2 ** attempt * 1000);
    return fetchObject(id, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for object ${id}`);
  return (await res.json()) as MetObject;
}

async function readPaintingCandidates(db: ReturnType<typeof openDb>): Promise<string[]> {
  await downloadOnce(CSV_URL, csvPath, "the Met dataset (about 300 MB)");
  const candidates: string[] = [];
  const parser = fs.createReadStream(csvPath).pipe(parse({ columns: true, bom: true, relax_quotes: true }));
  for await (const row of parser as AsyncIterable<MetCsvRow>) {
    report.csvRowsScanned++;
    if (!isPaintingRow(row)) continue;
    report.paintingRecords++;
    upsertArtwork(db, artworkFromCsv(row));
    if (row["Is Public Domain"] === "True") {
      report.publicDomainCandidates++;
      candidates.push(row["Object ID"].trim());
    }
    if (report.paintingRecords >= limit) break;
  }
  return candidates;
}

async function main() {
  const db = openDb();
  const checkedAt = new Date().toISOString();

  const candidates = ids ?? (await readPaintingCandidates(db));
  if (ids) report.publicDomainCandidates = ids.length;
  console.log(`${candidates.length} candidates for image checks`);

  if (!catalogOnly) {
    const delay = 1000 / rate;
    if (candidates.length) {
      console.log(`Checking images at ${rate} requests/second (about ${Math.ceil(candidates.length / rate / 60)} min)...`);
    }
    for (const [i, id] of candidates.entries()) {
      try {
        const obj = await fetchObject(id);
        if (!obj) {
          reject("object not found in API");
          continue;
        }
        const artworkId = upsertArtwork(db, artworkFromApi(obj));
        const decision = decideImage(obj, checkedAt);
        if (decision.image) {
          if (!upsertImage(db, artworkId, decision.image)) {
            report.skippedManualOverride++;
            continue;
          }
        } else {
          blockImages(db, artworkId);
        }
        if (decision.approved) report.imagesApproved++;
        else reject(decision.reason);
      } catch (err) {
        report.errors.push(`${id}: ${(err as Error).message}`);
        const existing = db
          .select({ id: artworks.id })
          .from(artworks)
          .where(and(eq(artworks.institution, MET_INSTITUTION), eq(artworks.sourceRecordId, id)))
          .get();
        if (existing) blockImages(db, existing.id);
      }
      if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${candidates.length}`);
      await sleep(delay);
    }
  }

  report.finishedAt = new Date().toISOString();
  const out = path.join(process.cwd(), "reports", `met-${report.startedAt.slice(0, 19).replace(/:/g, "-")}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  const { errors, ...summary } = report;
  console.log(JSON.stringify({ ...summary, errorCount: errors.length }, null, 2));
  if (errors.length) {
    console.log(`\nErrors (${errors.length}); these works stay catalog-only until a rerun succeeds:`);
    for (const e of errors.slice(0, 10)) console.log(`  ${e}`);
    if (errors.length > 10) console.log(`  ...and ${errors.length - 10} more in the report`);
  }
  console.log(`Report written to ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
