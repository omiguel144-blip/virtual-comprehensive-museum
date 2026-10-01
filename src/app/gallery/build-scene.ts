import { layoutRoom } from "@/lib/gallery-layout";
import type { HangableArtwork } from "@/lib/queries";
import { frameFor, paletteFor } from "./palette";
import type { DoorLink, GalleryWork, RoomScene } from "./types";

type DoorTarget = { href: string; label: string };

/** Builds the plain scene description the 3D room renders. */
export function buildScene(opts: {
  works: HangableArtwork[];
  title: string;
  subtitle: string;
  region: string;
  periodStart: number;
  intro: string[];
  west: DoorTarget;
  east: DoorTarget;
}): RoomScene {
  const room = layoutRoom(
    opts.works.map((w) => ({ id: w.id, heightCm: w.heightCm, widthCm: w.widthCm, displayMode: w.displayMode })),
  );
  const byId = new Map(opts.works.map((w) => [w.id, w]));
  const works: GalleryWork[] = room.placements.map((p) => {
    const w = byId.get(p.id)!;
    return {
      ...p,
      title: w.title,
      artist: w.artistName,
      date: w.dateDisplay,
      medium: w.medium,
      institution: w.institution,
      heightCm: w.heightCm,
      widthCm: w.widthCm,
      pixelWidth: w.image.pixelWidth,
      pixelHeight: w.image.pixelHeight,
      rightsStatement: w.image.rightsStatement,
      attributionText: w.image.attributionText,
      sourceRecordUrl: w.sourceRecordUrl,
      thumbnailUrl: w.image.thumbnailUrl,
      imageUrl: w.image.imageUrl,
      frame: frameFor({
        region: w.region ?? opts.region,
        year: w.yearStart,
        kind: p.kind,
        heightM: p.heightM,
        widthM: p.widthM,
        textile: w.objectType === "textile",
      }),
    };
  });
  const doors: DoorLink[] = room.doors.map((d) => ({ ...d, ...(d.side === "west" ? opts.west : opts.east) }));
  return {
    title: opts.title,
    subtitle: opts.subtitle,
    length: room.length,
    width: room.width,
    height: room.height,
    palette: paletteFor(opts.region, opts.periodStart),
    works,
    doors,
    obstacles: room.obstacles,
    bench: room.bench,
    intro: opts.intro,
  };
}

export function museumsIn(works: HangableArtwork[]): string {
  const names = [...new Set(works.map((w) => w.institution.replace(/^The /, "")))];
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "");
}
