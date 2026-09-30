# Virtual Comprehensive Museum

A searchable museum of painting history that shows high-quality images only when the holding institution marks them open access (or permission is on file), and links to the source for everything else. It also has a walkable 3D gallery where paintings hang at life scale.

## Quick start

```bash
npm install
npm run seed                          # 5 Met paintings via the Met API (needs internet)
npm run import:met -- --limit 500     # first 500 Met paintings (downloads a ~300 MB CSV once)
npm run import:aic                    # all Art Institute of Chicago paintings (~120 MB dump, ~10 s)
npm run import:cma                    # all Cleveland Museum of Art paintings (~130 MB CSV, ~10 s)
npm run dev                           # http://localhost:3000
```

The Met importer works in two stages:

1. Reads `MetObjects.csv` from the Met Open Access repo and stores every painting as a catalog record (no images).
2. For public-domain candidates, calls the Met object API (about 4 requests per second) and approves an image only when the record itself says `isPublicDomain` and has a `primaryImage` on `images.metmuseum.org`.

Each run writes a report to `reports/` with counts and rejection reasons. `--catalog-only` skips stage 2.

### Art Institute of Chicago and Cleveland

Both importers read the bulk datasets each museum publishes, so they make no per-record API calls and finish in seconds. Downloads are kept in `data/`; pass `--refresh` to fetch new copies.

| Source | Image shown only when | Otherwise |
| --- | --- | --- |
| Chicago | `is_public_domain` is true, an `image_id` exists, and there is no copyright notice | Catalog-only. AIC's IIIF server also serves copyrighted images, so an image ID alone never counts. |
| Cleveland | `share_license_status` is `CC0` and the image is on CMA's open-access CDN | Catalog-only. A CC0 flag next to a copyright notice is held as `PENDING_REVIEW`. |

Chicago images are hotlinked from its IIIF server (843 px for cards, 1686 px for detail pages), which AIC permits. Chicago's dump is refreshed only occasionally, so each image records the dump's own timestamp as its rights check date.

### Reading the import report

- `imagesApproved`: works now shown with an image.
- `rejected`: why other candidates stayed catalog-only (for example, no image on the Met record).
- `errorCount`: requests that failed, usually the Met API refusing or rate-limiting a few calls. Those works stay catalog-only; rerun the import to retry them. The first few errors are printed after the summary.

Warnings during `npm install` (deprecated packages, audit notices, the `allow-scripts` notice) are expected and don't affect the app.

## 3D gallery

Open http://localhost:3000/gallery. Pick a century room (and optionally one museum) at the top.

- Drag to look around, walk with W A S D or the arrow keys, and click a painting to walk up to it.
- Paintings hang at their measured size (1 scene unit = 1 meter), centered at eye level, so their scale is true relative to the room and to each other.
- Only works with an approved image **and** a measured painted-surface size are hung. Estimated sizes stay in the 2D catalog.
- If a photo's proportions differ from the measured size (a frame or crop in the photo), it keeps its own proportions within the measured area and the info panel says so. Images are never stretched.
- A smaller image loads first; the larger approved image loads when you walk within about 3 m.
- Textures load through `/api/gallery-image/<id>`, which re-checks the rights gate and only fetches from the three museums' image hosts.

### If gallery images don't load

Paintings that fail show as dark brown panels, and the info panel says so. Run:

```bash
npm run check:images
```

It fetches a few approved images per museum the same way the gallery does and prints the exact failure (HTTP status, timeout, and so on). The `npm run dev` terminal also logs each failure. If the server route fails, the browser tries the museum's own URL directly.

## Duplicates across museums

```bash
npm run dedupe                         # scan all records
npm run dedupe -- --list               # show pairs waiting for review
npm run dedupe -- --confirm <id>       # same object: merge
npm run dedupe -- --reject <id>        # different works: never proposed again
npm run dedupe -- --undo <id>          # unmerge (also marks them as different works)
```

- A shared Wikidata ID (published by the Met and Cleveland) merges automatically.
- Anything else (same artist, a title at least 80% similar, dates within 2 years, both sizes within 3%) only goes to review. Different museums rarely own the same object, while artists often repeat titles and canvas sizes, so fuzzy matches are never merged automatically.
- The kept record is the one with an approved image, then a measured size. Merged records are hidden from the catalog and gallery but linked from the kept record's page, with each museum's source.

## Takedowns

```bash
npm run takedown -- <artworkId>             # withdraw; imports can't restore it
npm run takedown -- <artworkId> --restore   # release back to review
```

## Tests

```bash
npm test            # rights gate, dimension parsing, importer mapping, store
npm run test:e2e    # withdrawn images never leak into HTML, JSON, or og:image
```

## Roadmap

1. ✅ Catalog, rights gate, Met importer
2. ✅ Art Institute of Chicago and Cleveland Museum of Art importers
3. ✅ Cross-source deduplication
4. ✅ 3D gallery room (React Three Fiber, 1 unit = 1 m, sized from unframed dimensions)
5. Artist opt-in submissions (after legal review)

This is an engineering safeguard, not legal advice. Review a sample of records from each source before publishing at scale.
