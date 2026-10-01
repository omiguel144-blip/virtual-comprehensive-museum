/**
 * Imports paintings from the Art Institute of Chicago's published data dump,
 * as AIC recommends for bulk use instead of paging its API.
 *
 *   npx tsx scripts/import/aic.ts [--limit N] [--refresh] [--no-verify]
 *
 * Afterwards it re-checks every stored image against the live AIC API (see
 * aic-verify.ts), because the dump can be over a year old.
 *
 * Images are hotlinked from AIC's IIIF server (which AIC permits) and only
 * for records the dump marks is_public_domain.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { openDb } from "../../src/db";
import { AIC_INSTITUTION, artworkFromAic, decideAicImage, isAicPainting, isAicTextile, type AicArtwork } from "./aic-map";
import { runAicVerify } from "./aic-verify";
import { applyRecord } from "./apply";
import { downloadOnce, flag, limitArg, newReport, writeReport } from "./common";

const DUMP_URL = "https://artic-api-data.s3.amazonaws.com/artic-api-data.tar.bz2";
const dataDir = path.join(process.cwd(), "data");
const archive = path.join(dataDir, "aic-data.tar.bz2");
const extractDir = path.join(dataDir, "aic");
const artworksDir = path.join(extractDir, "artic-api-data", "json", "artworks");

async function main() {
  const limit = limitArg();
  const report = newReport(AIC_INSTITUTION);
  await downloadOnce(DUMP_URL, archive, "the AIC data dump (about 120 MB)");

  if (!fs.existsSync(artworksDir) || flag("refresh")) {
    console.log("Extracting artwork records...");
    fs.mkdirSync(extractDir, { recursive: true });
    const tar = spawnSync("tar", ["-xjf", archive, "-C", extractDir, "artic-api-data/json/artworks"], {
      stdio: "inherit",
    });
    if (tar.status !== 0) throw new Error("tar extraction failed");
  }

  const db = openDb();
  const checkedAt = new Date().toISOString();
  const files = fs.readdirSync(artworksDir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    report.recordsScanned++;
    try {
      const record = JSON.parse(fs.readFileSync(path.join(artworksDir, file), "utf8")) as AicArtwork;
      const painting = isAicPainting(record);
      if (!painting && !isAicTextile(record)) continue;
      if (painting) report.paintingRecords++;
      else report.textileRecords++;
      applyRecord(db, report, artworkFromAic(record), decideAicImage(record, checkedAt));
    } catch (err) {
      report.errors.push(`${file}: ${(err as Error).message}`);
    }
    if (report.paintingRecords + report.textileRecords >= limit) break;
    if (report.recordsScanned % 20000 === 0) console.log(`  scanned ${report.recordsScanned}/${files.length}`);
  }

  writeReport("aic", report);

  if (!flag("no-verify")) {
    console.log("");
    await runAicVerify();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
