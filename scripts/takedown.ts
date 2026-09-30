/**
 * Withdraws (or restores) every image for an artwork. Sets manualOverride so
 * later imports cannot republish it.
 *
 *   npx tsx scripts/takedown.ts <artworkId> [--restore] [--status BLOCKED]
 */
import { eq, sql } from "drizzle-orm";
import { openDb } from "../src/db";
import { DISPLAY_STATUSES, images, type DisplayStatus } from "../src/db/schema";

const id = Number(process.argv[2]);
if (!Number.isInteger(id)) {
  console.error("Usage: npx tsx scripts/takedown.ts <artworkId> [--restore] [--status BLOCKED]");
  process.exit(1);
}
const restore = process.argv.includes("--restore");
const statusArg = process.argv[process.argv.indexOf("--status") + 1] as DisplayStatus;
const status: DisplayStatus = process.argv.includes("--status") && DISPLAY_STATUSES.includes(statusArg)
  ? statusArg
  : "WITHDRAWN";

const db = openDb();
const result = db
  .update(images)
  .set(
    restore
      ? { manualOverride: false, displayStatus: "PENDING_REVIEW", updatedAt: sql`CURRENT_TIMESTAMP` }
      : { manualOverride: true, displayStatus: status, updatedAt: sql`CURRENT_TIMESTAMP` },
  )
  .where(eq(images.artworkId, id))
  .run();
console.log(
  restore
    ? `Released ${result.changes} image(s) for artwork ${id} to PENDING_REVIEW; rerun the importer to re-check.`
    : `Set ${result.changes} image(s) for artwork ${id} to ${status} with manual override.`,
);
