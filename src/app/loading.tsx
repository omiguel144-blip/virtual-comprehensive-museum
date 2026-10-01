/** Shown while the catalog or a search loads. */
export default function CatalogLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-3" role="status">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-foreground" />
      <p className="text-muted">Loading the collection…</p>
    </div>
  );
}
