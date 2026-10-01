/**
 * Re-checks stored Art Institute of Chicago images against the live AIC API.
 * The bulk dump can be over a year old: images get replaced or unpublished,
 * and rights can change. Runs in batches of 100 at 1 request per second.
 *
 *   npx tsx scripts/import/aic-verify.ts
 */
import { openDb } from "../../src/db";
import { MUSEUM_REQUEST_HEADERS } from "../../src/lib/fetch-image";
import { AIC_VERIFY_FIELDS, type AicLiveRecord } from "./aic-map";
import { newVerifyReport, verifyAicImages } from "./aic-verify-core";
import { writeReport } from "./common";

const API = "https://api.artic.edu/api/v1/artworks";

async function fetchBatch(ids: string[], attempt = 1): Promise<AicLiveRecord[]> {
  const url = `${API}?ids=${ids.join(",")}&fields=${AIC_VERIFY_FIELDS}&limit=${ids.length}`;
  const res = await fetch(url, {
    headers: { ...MUSEUM_REQUEST_HEADERS, Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
    return fetchBatch(ids, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { data?: AicLiveRecord[] };
  if (!Array.isArray(body.data)) throw new Error("unexpected response shape");
  return body.data;
}

export async function runAicVerify() {
  const db = openDb();
  const report = newVerifyReport();
  console.log("Re-checking Chicago images against the live AIC API...");
  await verifyAicImages(db, (ids) => fetchBatch(ids), report);
  writeReport("aic-verify", report, "images in these batches were left unchanged; rerun to check them");
}

if (process.argv[1]?.endsWith("aic-verify.ts")) {
  runAicVerify().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
