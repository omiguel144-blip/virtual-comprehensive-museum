import type { Db } from "../../src/db";
import type { NewArtwork, NewImage } from "../../src/db/schema";
import { countReject, type ImportReport } from "./common";
import { blockImages, upsertArtwork, upsertImage } from "./store";

type Decision =
  | { approved: true; image: Omit<NewImage, "artworkId"> }
  | { approved: false; reason: string; image: Omit<NewImage, "artworkId"> | null };

/** Stores one artwork plus its image decision and updates the report. */
export function applyRecord(db: Db, report: ImportReport, artwork: NewArtwork, decision: Decision) {
  const artworkId = upsertArtwork(db, artwork);
  if (decision.image) {
    report.imageCandidates++;
    if (!upsertImage(db, artworkId, decision.image)) {
      report.skippedManualOverride++;
      return;
    }
  } else {
    // The source no longer offers an open image: block anything stored earlier.
    blockImages(db, artworkId);
  }
  if (decision.approved) report.imagesApproved++;
  else {
    if (decision.image?.displayStatus === "PENDING_REVIEW") report.imagesPendingReview++;
    countReject(report, decision.reason);
  }
}
