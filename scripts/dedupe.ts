/**
 * Finds and manages duplicate artwork records across collections.
 *
 *   npx tsx scripts/dedupe.ts                 scan; auto-merge shared Wikidata IDs, queue the rest
 *   npx tsx scripts/dedupe.ts --list          show pending candidates
 *   npx tsx scripts/dedupe.ts --confirm <id>  merge a candidate pair
 *   npx tsx scripts/dedupe.ts --reject <id>   mark as different works (never proposed again)
 *   npx tsx scripts/dedupe.ts --undo <id>     unmerge a pair and mark it as different works
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { openDb, type Db } from "../src/db";
import { artworks, duplicateCandidates, images, type DuplicateCandidate } from "../src/db/schema";
import { findCandidates, pickCanonical } from "../src/lib/dedupe";
import { isDisplayable } from "../src/lib/rights";

const argAfter = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : undefined;
};

function describe(db: Db, id: number) {
  const a = db.select().from(artworks).where(eq(artworks.id, id)).get();
  if (!a) return `#${id} (missing)`;
  const size = a.heightCm && a.widthCm ? `${a.heightCm}×${a.widthCm} cm` : "size unknown";
  return `#${a.id} ${a.title} / ${a.artistName ?? "unknown"} / ${a.dateDisplay ?? "?"} / ${size} / ${a.institution}\n      ${a.sourceRecordUrl}`;
}

/** Resolves chains so a record always points at a visible canonical record. */
function rootOf(db: Db, id: number): number {
  let current = id;
  for (let i = 0; i < 20; i++) {
    const row = db.select({ duplicateOf: artworks.duplicateOf }).from(artworks).where(eq(artworks.id, current)).get();
    if (!row?.duplicateOf) return current;
    current = row.duplicateOf;
  }
  return current;
}

function merge(db: Db, candidate: DuplicateCandidate, decidedBy: string) {
  const info = (id: number) => {
    const a = db.select().from(artworks).where(eq(artworks.id, id)).get()!;
    const imgs = db.select().from(images).where(eq(images.artworkId, id)).all();
    return { id, hasApprovedImage: imgs.some(isDisplayable), measured: a.dimensionConfidence === "measured" };
  };
  const a = rootOf(db, candidate.artworkA);
  const b = rootOf(db, candidate.artworkB);
  if (a !== b) {
    const { keep, hide } = pickCanonical(info(a), info(b));
    db.transaction((tx) => {
      // Anything already merged into the hidden record now points at the kept one.
      tx.update(artworks).set({ duplicateOf: keep }).where(eq(artworks.duplicateOf, hide)).run();
      tx.update(artworks).set({ duplicateOf: keep }).where(eq(artworks.id, hide)).run();
    });
  }
  db.update(duplicateCandidates)
    .set({ status: "CONFIRMED", decidedBy, decidedAt: new Date().toISOString(), updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(duplicateCandidates.id, candidate.id))
    .run();
}

function scan(db: Db) {
  const records = db
    .select({
      id: artworks.id,
      institution: artworks.institution,
      title: artworks.title,
      artistName: artworks.artistName,
      yearStart: artworks.yearStart,
      heightCm: artworks.heightCm,
      widthCm: artworks.widthCm,
      wikidataId: artworks.wikidataId,
    })
    .from(artworks)
    .all();
  const found = findCandidates(records);
  let added = 0;
  let merged = 0;
  for (const c of found) {
    const existing = db
      .select()
      .from(duplicateCandidates)
      .where(and(eq(duplicateCandidates.artworkA, c.artworkA), eq(duplicateCandidates.artworkB, c.artworkB)))
      .get();
    // Human decisions (and earlier merges) are final.
    if (existing && existing.status !== "PENDING") continue;
    const row =
      existing ??
      db.insert(duplicateCandidates).values({ artworkA: c.artworkA, artworkB: c.artworkB, reason: c.reason, score: c.score }).returning().get();
    if (!existing) added++;
    if (c.auto) {
      merge(db, row, "auto:wikidata");
      merged++;
    }
  }
  const pending = db.select({ n: sql<number>`count(*)` }).from(duplicateCandidates).where(eq(duplicateCandidates.status, "PENDING")).get()!.n;
  const hidden = db.select({ n: sql<number>`count(*)` }).from(artworks).where(sql`${artworks.duplicateOf} is not null`).get()!.n;
  const withQid = records.filter((r) => r.wikidataId).length;
  console.log(
    JSON.stringify(
      { records: records.length, withWikidataId: withQid, candidatesFound: found.length, newCandidates: added, autoMerged: merged, pendingReview: pending, hiddenAsDuplicates: hidden },
      null,
      2,
    ),
  );
  if (pending) console.log(`\nReview with: npm run dedupe -- --list`);
}

function list(db: Db) {
  const rows = db.select().from(duplicateCandidates).where(eq(duplicateCandidates.status, "PENDING")).all();
  if (!rows.length) return console.log("No pending duplicate candidates.");
  for (const r of rows) {
    console.log(`\nCandidate ${r.id} (${r.reason})\n  A ${describe(db, r.artworkA)}\n  B ${describe(db, r.artworkB)}`);
  }
  console.log(`\nMerge with --confirm <candidate>, or keep separate with --reject <candidate>.`);
}

function get(db: Db, id: number | undefined) {
  const row = id ? db.select().from(duplicateCandidates).where(eq(duplicateCandidates.id, id)).get() : undefined;
  if (!row) {
    console.error(`No candidate ${id}. See: npm run dedupe -- --list`);
    process.exit(1);
  }
  return row;
}

function main() {
  const db = openDb();
  if (process.argv.includes("--list")) return list(db);

  const confirm = argAfter("confirm");
  const reject = argAfter("reject");
  const undo = argAfter("undo");
  if (confirm !== undefined) {
    const c = get(db, confirm);
    merge(db, c, "human");
    return console.log(`Merged. Visible record: #${rootOf(db, c.artworkA)}`);
  }
  if (reject !== undefined) {
    const c = get(db, reject);
    db.update(duplicateCandidates)
      .set({ status: "REJECTED", decidedBy: "human", decidedAt: new Date().toISOString() })
      .where(eq(duplicateCandidates.id, c.id))
      .run();
    return console.log(`Marked #${c.artworkA} and #${c.artworkB} as different works.`);
  }
  if (undo !== undefined) {
    const c = get(db, undo);
    db.update(artworks)
      .set({ duplicateOf: null })
      .where(and(inArray(artworks.id, [c.artworkA, c.artworkB]), sql`${artworks.duplicateOf} in (${c.artworkA}, ${c.artworkB})`))
      .run();
    // A human undo is final: the next scan must not merge this pair again.
    db.update(duplicateCandidates)
      .set({ status: "REJECTED", decidedBy: "human", decidedAt: new Date().toISOString() })
      .where(eq(duplicateCandidates.id, c.id))
      .run();
    return console.log(`Unmerged #${c.artworkA} and #${c.artworkB} and marked them as different works.`);
  }
  scan(db);
}

main();
