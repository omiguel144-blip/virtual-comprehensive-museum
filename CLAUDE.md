@AGENTS.md

# Virtual Comprehensive Museum

A catalog of painting history. Core rule: **an artwork can enter the catalog without its image; an image cannot appear until its reuse rights are verified.**

## Rights policy (non-negotiable)
- Never treat image availability (an API URL, a IIIF endpoint, a thumbnail online) as reuse permission.
- Never publish images with unknown, missing, or conflicting rights. New images default to `PENDING_REVIEW` or `BLOCKED`.
- Never use Google Images or scraped search results as an image source.
- Respect each source's rate limits and terms; prefer bulk datasets over mass API scraping. Never use The Met's retiring `/v1/search`; use `/v1.1/search` if search is needed.
- Preserve rights evidence: `rightsEvidenceUrl`, `rightsStatement`, `rightsCheckedAt` on every approved image.
- Imports must never overwrite rows with `manualOverride` (takedowns).
- No public uploads or image downloads without a human review of the legal process first.
- CC BY-NC images are out of scope for now.

## Architecture
- Next.js App Router + TypeScript + Tailwind. Drizzle ORM on SQLite (`data/museum.db`, override with `DATABASE_PATH`).
- Schema: `src/db/schema.ts`. After changing it, run `npm run db:generate` and commit the new file in `drizzle/`.
- **Rights gate:** `src/lib/rights.ts` is the only place that decides whether an image is displayable. `src/lib/queries.ts` is the only public read path and never returns raw `images` rows. Any new surface (pages, API, OG tags, 3D textures) must use these.
- Importers live in `scripts/import/`; keep source mapping pure (`*-map.ts`) and tested.

## Commands
- `npm test` (unit), `npm run test:e2e` (leak test), `npm run lint`, `npm run typecheck`
- `npm run import:met -- --limit 500`, `npm run seed`, `npm run takedown -- <artworkId>`
