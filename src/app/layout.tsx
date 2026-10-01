import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Virtual Comprehensive Museum", template: "%s | Virtual Comprehensive Museum" },
  description: "A catalog of painting history that shows only images whose reuse rights are verified.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      {/* Browser extensions (e.g. Grammarly) add attributes to <body>; ignore those mismatches. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <header className="border-b border-border">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4">
            <Link href="/" className="font-serif text-xl tracking-tight">
              Virtual Comprehensive Museum
            </Link>
            <form action="/" role="search" className="order-last w-full sm:order-none sm:w-auto sm:flex-1 sm:max-w-sm">
              <label className="sr-only" htmlFor="site-search">
                Search the collection
              </label>
              <input
                id="site-search"
                name="q"
                type="search"
                placeholder="Search artists, titles, places…"
                className="w-full rounded-full border border-border bg-surface px-4 py-1.5 text-sm"
              />
            </form>
            <span className="flex gap-5 text-sm">
              <Link href="/gallery" className="text-muted hover:text-foreground">
                Gallery
              </Link>
              <Link href="/about/rights" className="text-muted hover:text-foreground">
                Image rights
              </Link>
            </span>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted">
          Images appear only when the holding institution marks them open access or permission is on file.
          Everything else links to its source.
        </footer>
      </body>
    </html>
  );
}
