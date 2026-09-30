import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export const flag = (name: string) => process.argv.includes(`--${name}`);

export const limitArg = () => (arg("limit") ? Number(arg("limit")) : Infinity);

/** Downloads a file once; reuses it on later runs unless --refresh is passed. */
export async function downloadOnce(url: string, dest: string, label: string) {
  if (fs.existsSync(dest) && !flag("refresh")) return;
  console.log(`Downloading ${label} from ${url} (one time)...`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await pipeline(Readable.fromWeb(res.body as never), fs.createWriteStream(`${dest}.part`));
  fs.renameSync(`${dest}.part`, dest);
}

export type ImportReport = {
  source: string;
  startedAt: string;
  finishedAt: string;
  recordsScanned: number;
  paintingRecords: number;
  imageCandidates: number;
  imagesApproved: number;
  imagesPendingReview: number;
  catalogOnly: number;
  skippedManualOverride: number;
  rejected: Record<string, number>;
  errors: string[];
};

export function newReport(source: string): ImportReport {
  return {
    source,
    startedAt: new Date().toISOString(),
    finishedAt: "",
    recordsScanned: 0,
    paintingRecords: 0,
    imageCandidates: 0,
    imagesApproved: 0,
    imagesPendingReview: 0,
    catalogOnly: 0,
    skippedManualOverride: 0,
    rejected: {},
    errors: [],
  };
}

export function countReject(report: { rejected: Record<string, number>; catalogOnly: number }, reason: string) {
  report.rejected[reason] = (report.rejected[reason] ?? 0) + 1;
  report.catalogOnly++;
}

export function writeReport(slug: string, report: { startedAt: string; finishedAt: string; errors: string[] }) {
  report.finishedAt = new Date().toISOString();
  const out = path.join(process.cwd(), "reports", `${slug}-${report.startedAt.slice(0, 19).replace(/:/g, "-")}.json`);
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
