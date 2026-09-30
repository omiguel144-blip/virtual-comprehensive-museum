/**
 * Imports paintings from the Cleveland Museum of Art Open Access dataset
 * (CSV from github.com/ClevelandMuseumArt/openaccess, CC0 data).
 *
 *   npx tsx scripts/import/cma.ts [--limit N] [--refresh]
 *
 * Images come only from records marked CC0 with an image on CMA's CDN.
 */
import { parse } from "csv-parse";
import fs from "node:fs";
import path from "node:path";
import { openDb } from "../../src/db";
import { applyRecord } from "./apply";
import { artworkFromCma, CMA_INSTITUTION, decideCmaImage, isCmaPainting, type CmaRow } from "./cma-map";
import { downloadOnce, limitArg, newReport, writeReport } from "./common";

const CSV_URL = "https://media.githubusercontent.com/media/ClevelandMuseumArt/openaccess/master/data.csv";
const csvPath = path.join(process.cwd(), "data", "cma-data.csv");

async function main() {
  const limit = limitArg();
  const report = newReport(CMA_INSTITUTION);
  await downloadOnce(CSV_URL, csvPath, "the CMA dataset (about 130 MB)");

  const db = openDb();
  const checkedAt = new Date().toISOString();
  const parser = fs.createReadStream(csvPath).pipe(parse({ columns: true, bom: true, relax_quotes: true }));

  for await (const row of parser as AsyncIterable<CmaRow>) {
    report.recordsScanned++;
    if (!isCmaPainting(row)) continue;
    report.paintingRecords++;
    try {
      applyRecord(db, report, artworkFromCma(row), decideCmaImage(row, checkedAt));
    } catch (err) {
      report.errors.push(`${row["id"]}: ${(err as Error).message}`);
    }
    if (report.paintingRecords >= limit) break;
  }

  writeReport("cma", report);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
