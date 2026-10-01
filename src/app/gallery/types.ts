import type { Door, Placement } from "@/lib/gallery-layout";
import type { FrameStyle, RoomPalette } from "./palette";

/** Plain data passed from the server page to the 3D scene. */
export type GalleryWork = Placement & {
  title: string;
  artist: string | null;
  date: string | null;
  medium: string | null;
  institution: string;
  heightCm: number;
  widthCm: number;
  pixelWidth: number | null;
  pixelHeight: number | null;
  rightsStatement: string | null;
  attributionText: string | null;
  sourceRecordUrl: string;
  /** Rights-approved image URLs, used directly if the same-origin route fails. */
  thumbnailUrl: string;
  imageUrl: string;
  frame: FrameStyle;
};

export type DoorLink = Door & { href: string; label: string };

export type RoomScene = {
  title: string;
  subtitle: string;
  length: number;
  width: number;
  height: number;
  palette: RoomPalette;
  works: GalleryWork[];
  doors: DoorLink[];
  obstacles: Array<[number, number, number, number]>;
  bench: [number, number, number] | null;
  /** Wall text beside the entrance. */
  intro: string[];
};
