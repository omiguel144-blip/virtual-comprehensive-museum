import Link from "next/link";
import { getDb } from "@/db";
import { listArtworks, listInstitutions } from "@/lib/queries";
import { ArtworkCard } from "./artwork-card";

export const dynamic = "force-dynamic";

const CENTURIES = Array.from({ length: 8 }, (_, i) => 21 - i).concat([13, 12, 11]);

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default async function CatalogPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(params.q);
  const centuryParam = one(params.century);
  const institution = one(params.institution);
  const withImages = one(params.images) === "1";
  const page = Number(one(params.page)) || 1;

  const db = getDb();
  const [{ items, total, pageSize }, institutions] = await Promise.all([
    listArtworks(db, {
      q,
      century: centuryParam ? Number(centuryParam) : undefined,
      institution: institution || undefined,
      withImages,
      page,
    }),
    listInstitutions(db),
  ]);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const pageHref = (p: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (centuryParam) next.set("century", centuryParam);
    if (institution) next.set("institution", institution);
    if (withImages) next.set("images", "1");
    next.set("page", String(p));
    return `/?${next}`;
  };

  return (
    <div className="space-y-6">
      <form className="flex flex-wrap items-end gap-3" action="/">
        <label className="flex min-w-60 flex-1 flex-col gap-1 text-sm">
          Search
          <input
            name="q"
            defaultValue={q}
            placeholder="Title, artist, medium, culture"
            className="rounded border border-border bg-surface px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Century
          <select name="century" defaultValue={centuryParam} className="rounded border border-border bg-surface px-3 py-2">
            <option value="">Any</option>
            {CENTURIES.map((c) => (
              <option key={c} value={c}>
                {ordinal(c)} century
              </option>
            ))}
          </select>
        </label>
        {institutions.length > 1 && (
          <label className="flex flex-col gap-1 text-sm">
            Institution
            <select name="institution" defaultValue={institution} className="rounded border border-border bg-surface px-3 py-2">
              <option value="">All</option>
              {institutions.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2 py-2 text-sm">
          <input type="checkbox" name="images" value="1" defaultChecked={withImages} />
          With images only
        </label>
        <button className="rounded bg-foreground px-4 py-2 text-sm text-background">Filter</button>
      </form>

      <p className="text-sm text-muted">
        {total.toLocaleString()} {total === 1 ? "work" : "works"}
      </p>

      {items.length === 0 ? (
        <p className="py-16 text-center text-muted">
          No works found. Run <code>npm run import:met</code> to load the catalog.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((artwork) => (
            <li key={artwork.id} className="flex">
              <ArtworkCard artwork={artwork} />
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-4 text-sm">
          {page > 1 && <Link href={pageHref(page - 1)}>Previous</Link>}
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          {page < pages && <Link href={pageHref(page + 1)}>Next</Link>}
        </nav>
      )}
    </div>
  );
}
