# Virtual Comprehensive Museum

A searchable museum of painting history (plus tapestries, hangings, carpets and other display textiles) that shows high-quality images only when the holding institution marks them open access (or permission is on file), and links to the source for everything else. It also has a walkable 3D gallery where paintings hang at life scale.

## Quick start

```bash
npm install
npm run seed                          # 5 Met paintings via the Met API (needs internet)
npm run import:met                    # all Met paintings and display textiles (~300 MB CSV once; about 25 min of API checks)
npm run import:aic                    # all Art Institute of Chicago paintings (~120 MB dump), then a live re-check
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

Chicago images are hotlinked from its IIIF server (843 px for cards, 1686 px for detail pages), which AIC permits.

Chicago's dump is refreshed only occasionally (the current one is from February 2025), and since then AIC has replaced or unpublished some images and changed some rights. So `import:aic` finishes by re-checking every stored Chicago image against the live AIC API: 100 works per request, one request per second (about 20 seconds in total). Unchanged images get a fresh check date, replaced images get their new URLs, and anything no longer public domain, now carrying a copyright notice, or removed is blocked. Takedowns are never touched, and a failed request leaves its batch unchanged. Run it alone with `npm run verify:aic`, or skip it with `npm run import:aic -- --no-verify`.

### Reading the import report

- `imagesApproved`: works now shown with an image.
- `rejected`: why other candidates stayed catalog-only (for example, no image on the Met record).
- `errorCount`: requests that failed, usually the Met API refusing or rate-limiting a few calls. Those works stay catalog-only; rerun the import to retry them. The first few errors are printed after the summary.

Warnings during `npm install` (deprecated packages, audit notices, the `allow-scripts` notice) are expected and don't affect the app.

## Search

The search bar at the top of every page matches every word you type against title, artist, medium, culture, region and period, ignoring accents and capitals ("caravaggio saint", "cafe arles"). The catalog adds filters for century, region, type (paintings or textiles) and museum. On any search, **Hang these results in 3D** builds a room from the matches.

## Galleries

Open http://localhost:3000/gallery for the floor plan: wings (Europe, the Americas, Asia, Africa, Ancient), each region, and its period rooms, e.g. *Italy: 17th Century*, *China: Ming Dynasty (1368–1644)*, *Japan: Edo Period*, *South Asia: Mughal and Deccani Courts*.

- **Regions** come from each record's culture, place of origin, artist nationality and department (`src/lib/regions.ts`); nothing is guessed from artist names. Anything unclear goes to "Other and Unassigned". After changing the rules, run `npm run classify` (it also runs automatically for records that have never been classified).
- **Rooms** hold up to 30 works; larger galleries continue through doorways into the next room, and the last room leads to the next period.
- **The hang** follows museum practice: a 1.45 m center line, chronological order in one loop (in along the left wall, back along the right), the largest work alone on the far wall as the sightline, small neighbors stacked in pairs, and up to eight cases (album leaves, small works) and four scroll cases down the middle.
- **The look:** wall colors by tradition (deep red for Italian Baroque, green for Dutch, ink grey for China, indigo for Japan, light walls for modern), gilt frames for European oil paintings, silk mounts with rollers for East Asian hanging scrolls, rods for tapestries, picture lights, wall labels, a wood floor, a bench, wall text at the entrance, and titled doorways.
- Drag to look, walk with W A S D or the arrow keys, click a work to walk up to it, and walk into (or click) a doorway to go through.
- Works hang at their measured size (1 scene unit = 1 meter). Only works with an approved image **and** a measured painted-surface size are hung; the catalog lists everything.
- A smaller image loads first; the larger approved image loads when you walk within about 3 m. Textures load through `/api/gallery-image/<id>`, which re-checks the rights gate and only fetches from the three museums' image hosts.

### If gallery images don't load

Paintings that fail show as dark brown panels, and the info panel says so. Run:

```bash
npm run check:images
```

It fetches a few approved images per museum the same way the gallery does and prints the exact failure (HTTP status, timeout, and so on). To test specific works from the dev log (`[gallery-image] artwork 3049 ...`), run `npm run check:images -- --ids 3049,1403`; add `--institution "Art Institute of Chicago" --all` to test every image from one museum.

- **Chicago 403 or 404:** usually the image was replaced or unpublished after the data dump. Run `npm run verify:aic`.
- The gallery loads at most three images at a time and retries a refused request once, so museum servers aren't hit with bursts. If the server route still fails, the browser tries the museum's own URL directly.
- `THREE.Clock: This module has been deprecated` in the browser console comes from inside the 3D library and is harmless.

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
5. ✅ Region and period galleries, search rooms, display textiles
6. Objects on pedestals (vessels, sculpture) once real 3D models are available
7. Artist opt-in submissions (after legal review)

This is an engineering safeguard, not legal advice. Review a sample of records from each source before publishing at scale.
