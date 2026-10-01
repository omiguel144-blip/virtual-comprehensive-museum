import { spawnSync } from "node:child_process";
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchToFile(url: string, part: string) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as never), fs.createWriteStream(part));
}

/** curl often succeeds where Node's fetch times out (VPNs, proxies, IPv6 quirks). */
function curlToFile(url: string, part: string) {
  const result = spawnSync(
    "curl",
    ["-L", "--fail", "--retry", "3", "--connect-timeout", "30", "--progress-bar", "-o", part, url],
    { stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`curl exited with code ${result.status}`);
}

/**
 * Downloads a file once; reuses it on later runs unless --refresh is passed.
 * Tries fetch three times with backoff, then falls back to curl.
 */
export async function downloadOnce(url: string, dest: string, label: string) {
  if (fs.existsSync(dest) && !flag("refresh")) return;
  console.log(`Downloading ${label} from ${url} (one time)...`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const part = `${dest}.part`;

  const attempts: Array<() => Promise<void> | void> = [
    () => fetchToFile(url, part),
    () => fetchToFile(url, part),
    () => fetchToFile(url, part),
    () => curlToFile(url, part),
  ];
  for (const [i, attempt] of attempts.entries()) {
    try {
      await attempt();
      fs.renameSync(part, dest);
      return;
    } catch (err) {
      fs.rmSync(part, { force: true });
      const cause = (err as { cause?: { code?: string } }).cause?.code;
      console.warn(`  attempt ${i + 1} failed: ${(err as Error).message}${cause ? ` (${cause})` : ""}`);
      if (i < attempts.length - 1) await sleep(2 ** (i + 1) * 1000);
    }
  }
  throw new Error(
    `Could not download ${label}. Check your connection (or turn off a VPN), or download it yourself:\n` +
      `  curl -L -o "${path.relative(process.cwd(), dest)}" "${url}"\n` +
      `then rerun this command; the file will be reused.`,
  );
}

export type ImportReport = {
  source: string;
  startedAt: string;
  finishedAt: string;
  recordsScanned: number;
  paintingRecords: number;
  textileRecords: number;
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
    textileRecords: 0,
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

export function writeReport(
  slug: string,
  report: { startedAt: string; finishedAt: string; errors: string[] },
  errorNote = "these works stay catalog-only until a rerun succeeds",
) {
  report.finishedAt = new Date().toISOString();
  const out = path.join(process.cwd(), "reports", `${slug}-${report.startedAt.slice(0, 19).replace(/:/g, "-")}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  const { errors, ...summary } = report;
  console.log(JSON.stringify({ ...summary, errorCount: errors.length }, null, 2));
  if (errors.length) {
    console.log(`\nErrors (${errors.length}); ${errorNote}:`);
    for (const e of errors.slice(0, 10)) console.log(`  ${e}`);
    if (errors.length > 10) console.log(`  ...and ${errors.length - 10} more in the report`);
  }
  console.log(`Report written to ${out}`);
}
