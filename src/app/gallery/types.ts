import type { Placement } from "@/lib/gallery-layout";

/** Plain data passed from the server page to the 3D scene. */
export type GalleryPainting = Placement & {
  title: string;
  artist: string | null;
  date: string | null;
  institution: string;
  heightCm: number;
  widthCm: number;
  dimensionSource: string | null;
  pixelWidth: number | null;
  pixelHeight: number | null;
  rightsStatement: string | null;
  attributionText: string | null;
  sourceRecordUrl: string;
  /** Rights-approved image URLs, used directly if the same-origin route fails. */
  thumbnailUrl: string;
  imageUrl: string;
};
