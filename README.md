# Virtual Comprehensive Museum

A searchable museum of painting history that shows high-quality images only when the holding institution marks them open access (or permission is on file), and links to the source for everything else. A walkable, life-scale 3D gallery comes later.

## Quick start

```bash
npm install
npm run seed                          # 5 Met paintings via the Met API (needs internet)
npm run import:met -- --limit 500     # first 500 Met paintings (downloads a ~300 MB CSV once)
npm run dev                           # http://localhost:3000
```

The Met importer works in two stages:

1. Reads `MetObjects.csv` from the Met Open Access repo and stores every painting as a catalog record (no images).
2. For public-domain candidates, calls the Met object API (about 4 requests per second) and approves an image only when the record itself says `isPublicDomain` and has a `primaryImage` on `images.metmuseum.org`.

Each run writes a report to `reports/` with counts and rejection reasons. `--catalog-only` skips stage 2.

### Reading the import report

- `imagesApproved`: works now shown with an image.
- `rejected`: why other candidates stayed catalog-only (for example, no image on the Met record).
- `errorCount`: requests that failed, usually the Met API refusing or rate-limiting a few calls. Those works stay catalog-only; rerun the import to retry them. The first few errors are printed after the summary.

Warnings during `npm install` (deprecated packages, audit notices, the `allow-scripts` notice) are expected and don't affect the app.

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
2. Art Institute of Chicago and Cleveland Museum of Art importers
3. Cross-source deduplication
4. 3D gallery room (React Three Fiber, 1 unit = 1 m, sized from unframed dimensions)
5. Artist opt-in submissions (after legal review)

This is an engineering safeguard, not legal advice. Review a sample of records from each source before publishing at scale.
