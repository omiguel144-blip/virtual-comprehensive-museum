import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../../src/db";
import { artworks, images } from "../../src/db/schema";
import { AIC_INSTITUTION, decideAicVerification, type AicLiveRecord } from "./aic-map";
import { newReport } from "./common";

export const AIC_BATCH_SIZE = 100;

export type FetchBatch = (ids: string[]) => Promise<AicLiveRecord[]>;

export function newVerifyReport() {
  return { ...newReport(`${AIC_INSTITUTION} (live re-check)`), checked: 0, confirmed: 0, updated: 0, blocked: 0 };
}
export type VerifyReport = ReturnType<typeof newVerifyReport>;

/**
 * Re-checks every importer-managed AIC image against the live API, in
 * batches. Rows with manualOverride (takedowns) are never touched.
 */
export async function verifyAicImages(
  db: Db,
  fetchBatch: FetchBatch,
  report: VerifyReport,
  { pauseMs = 1000 }: { pauseMs?: number } = {},
) {
  const rows = db
    .select({
      imageId: images.id,
      imageUrl: images.imageUrl,
      thumbnailUrl: images.thumbnailUrl,
      pixelWidth: images.pixelWidth,
      pixelHeight: images.pixelHeight,
      status: images.displayStatus,
      sourceId: artworks.sourceRecordId,
    })
    .from(images)
    .innerJoin(artworks, eq(images.artworkId, artworks.id))
    .where(and(eq(artworks.institution, AIC_INSTITUTION), eq(images.manualOverride, false)))
    .all()
    // Only images that are, or could become, visible need checking.
    .filter((r) => r.status === "APPROVED" || r.status === "PENDING_REVIEW");

  const checkedAt = new Date().toISOString();
  for (let i = 0; i < rows.length; i += AIC_BATCH_SIZE) {
    const batch = rows.slice(i, i + AIC_BATCH_SIZE);
    let live: Map<string, AicLiveRecord>;
    try {
      const records = await fetchBatch(batch.map((r) => r.sourceId));
      live = new Map(records.map((r) => [String(r.id), r]));
    } catch (err) {
      // Leave this batch as it is; a failed request is not evidence either way.
      report.errors.push(`batch starting at ${batch[0].sourceId}: ${(err as Error).message}`);
      continue;
    }

    for (const row of batch) {
      report.checked++;
      const decision = decideAicVerification(row, live.get(row.sourceId));
      const where = and(eq(images.id, row.imageId), eq(images.manualOverride, false));
      if (decision.action === "confirm") {
        report.confirmed++;
        db.update(images).set({ rightsCheckedAt: checkedAt, updatedAt: sql`CURRENT_TIMESTAMP` }).where(where).run();
      } else if (decision.action === "update") {
        report.updated++;
        db.update(images)
          .set({
            imageUrl: decision.imageUrl,
            thumbnailUrl: decision.thumbnailUrl,
            pixelWidth: decision.pixelWidth,
            pixelHeight: decision.pixelHeight,
            rightsCheckedAt: checkedAt,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(where)
          .run();
      } else {
        report.blocked++;
        report.rejected[decision.reason] = (report.rejected[decision.reason] ?? 0) + 1;
        db.update(images).set({ displayStatus: "BLOCKED", updatedAt: sql`CURRENT_TIMESTAMP` }).where(where).run();
      }
    }
    if (i + AIC_BATCH_SIZE < rows.length && pauseMs) await new Promise((r) => setTimeout(r, pauseMs));
  }
}
