/** Shown the moment a gallery link is clicked, while the room (and, in development, the 3D code) loads. */
export default function GalleryLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center" role="status">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
      <p className="font-serif text-lg">Opening the galleries…</p>
      <p className="max-w-sm text-sm text-muted">The first visit after starting the server can take a few seconds while the 3D rooms are prepared.</p>
    </div>
  );
}
