import type { Metadata } from "next";

export const metadata: Metadata = { title: "Image rights" };

export default function RightsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5 leading-relaxed">
      <h1 className="font-serif text-3xl">Image rights</h1>
      <p>
        This museum lists works from many collections, but it shows an image only when its reuse is clearly
        allowed. Every other work appears as a catalog record with a link to the institution that holds it.
      </p>
      <h2 className="font-serif text-xl">When an image is shown</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li>The holding institution marks that specific image as public domain or CC0, or</li>
        <li>It carries a license whose conditions we meet (such as credit and a license link), or</li>
        <li>The artist or rights holder has given written permission.</li>
      </ul>
      <p>
        An image being online is not treated as permission. Each approved image keeps a record of the source
        statement it relied on and when it was checked.
      </p>
      <h2 className="font-serif text-xl">Removal requests</h2>
      <p>
        If you hold rights in an image shown here and believe it should not be, contact the site owner with the
        page address. The image is withdrawn while the request is reviewed, and later imports cannot restore it
        automatically.
      </p>
    </div>
  );
}
