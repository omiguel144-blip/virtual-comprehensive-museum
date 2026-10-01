/**
 * Pure layout math for the 3D gallery. Units are meters: 1 scene unit = 1 m.
 *
 * Curatorial rules:
 * - Wall works hang on a common center line of 1.45 m (museum standard).
 * - The hang reads chronologically in one loop: in along the left (north)
 *   wall, past an anchor work on the far (east) wall, and back along the
 *   right (south) wall.
 * - The anchor is the largest wall work, hung alone on the end wall so it is
 *   visible from the entrance.
 * - Neighboring small works are stacked in pairs instead of scattered.
 * - Album leaves and handscrolls sit in cases down the middle of the room.
 * - The room is sized to what it holds.
 */

export const CENTER_LINE = 1.45;
export const MIN_ROOM_LENGTH = 10;
export const BASE_ROOM_WIDTH = 9;
export const END_MARGIN = 2.2;
export const DOOR_WIDTH = 1.6;
export const DOOR_HEIGHT = 2.7;
/** How far image and measured aspect ratios may differ before we flag it. */
export const ASPECT_TOLERANCE = 0.06;
/** Works whose longer side is under this are stacked in pairs. */
export const SMALL_WORK_M = 0.45;

export type DisplayKind = "wall" | "case" | "scroll_case";

export type HangInput = { id: number; heightCm: number; widthCm: number; displayMode?: DisplayKind };

export type Placement = {
  id: number;
  kind: DisplayKind;
  /** Center of the work in world space. Case works: center of the case top. */
  position: [number, number, number];
  /** Y rotation so a wall work faces into the room (or a case work faces its viewer). */
  rotationY: number;
  /** Physical size of the work in meters. */
  widthM: number;
  heightM: number;
  /** "north" | "south" | "east" for wall works, "center" for cases. */
  wall: "north" | "south" | "east" | "center";
};

export type Door = { side: "west" | "east"; position: [number, number, number]; rotationY: number };

export type Room = {
  length: number;
  width: number;
  height: number;
  placements: Placement[];
  doors: Door[];
  /** Footprints visitors can't walk through: [x, z, halfX, halfZ]. */
  obstacles: Array<[number, number, number, number]>;
  bench: [number, number, number] | null;
};

export const cmToM = (cm: number) => Math.round(cm) / 100;

type Column = { items: Array<{ input: HangInput; w: number; h: number }>; width: number; height: number };

const isSmall = (w: number, h: number) => Math.max(w, h) < SMALL_WORK_M;
const STACK_GAP = 0.18;

/** Groups consecutive small works into vertical pairs. */
function toColumns(items: HangInput[]): Column[] {
  const columns: Column[] = [];
  for (const input of items) {
    const w = cmToM(input.widthCm);
    const h = cmToM(input.heightCm);
    const last = columns[columns.length - 1];
    if (last && last.items.length === 1 && isSmall(w, h) && isSmall(last.items[0].w, last.items[0].h)) {
      last.items.push({ input, w, h });
      last.width = Math.max(last.width, w);
      last.height = last.height + STACK_GAP + h;
    } else {
      columns.push({ items: [{ input, w, h }], width: w, height: h });
    }
  }
  return columns;
}

/** Breathing room between neighbors grows with their size. */
export function gapBetween(a: number, b: number): number {
  return Math.min(1.6, Math.max(0.6, 0.45 + 0.3 * ((a + b) / 2)));
}

const wallRunLength = (cols: Column[]) =>
  cols.reduce((sum, c, i) => sum + c.width + (i > 0 ? gapBetween(cols[i - 1].width, c.width) : 0), 0);

/** Splits a chronological run of columns at the point that best balances two walls. */
function splitBalanced(cols: Column[]): [Column[], Column[]] {
  let best = Math.ceil(cols.length / 2);
  let bestDiff = Infinity;
  for (let i = 0; i <= cols.length; i++) {
    const diff = Math.abs(wallRunLength(cols.slice(0, i)) - wallRunLength(cols.slice(i)));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return [cols.slice(0, best), cols.slice(best)];
}

function verticalCenter(heightM: number, ceiling: number) {
  // Tall works lift so their bottom edge clears the floor; nothing touches the cornice.
  const y = Math.max(CENTER_LINE, heightM / 2 + 0.35);
  return Math.min(y, ceiling - heightM / 2 - 0.3);
}

/**
 * Hangs a column run along a wall. `dir` is +1 when reading order runs toward
 * +x (north wall) and -1 when it runs toward -x (south wall).
 */
function hangRun(cols: Column[], wall: "north" | "south", z: number, dir: 1 | -1, ceiling: number): Placement[] {
  const total = wallRunLength(cols);
  let cursor = -total / 2;
  const out: Placement[] = [];
  cols.forEach((col, i) => {
    if (i > 0) cursor += gapBetween(cols[i - 1].width, col.width);
    const centerAlong = cursor + col.width / 2;
    cursor += col.width;
    const x = centerAlong * dir;
    const rotationY = wall === "north" ? 0 : Math.PI;
    if (col.items.length === 1) {
      const { input, w, h } = col.items[0];
      out.push({ id: input.id, kind: "wall", position: [x, verticalCenter(h, ceiling), z], rotationY, widthM: w, heightM: h, wall });
    } else {
      // A stacked pair, centered as a group on the center line.
      const top = CENTER_LINE + col.height / 2;
      let y = top;
      for (const { input, w, h } of col.items) {
        out.push({ id: input.id, kind: "wall", position: [x, y - h / 2, z], rotationY, widthM: w, heightM: h, wall });
        y -= h + STACK_GAP;
      }
    }
  });
  return out;
}

/** Lays out one room from works already in chronological order. */
export const MAX_CASES = 8;
export const MAX_SCROLL_CASES = 4;

export function layoutRoom(items: HangInput[]): Room {
  // A few cases punctuate a room; beyond that, small works hang framed on the wall
  // (as museums do with most miniatures), keeping the room a walkable size.
  let cases = 0;
  let scrolls = 0;
  const kindOf = (i: HangInput): DisplayKind => {
    if (i.displayMode === "case" && cases < MAX_CASES) return (cases++, "case");
    if (i.displayMode === "scroll_case" && scrolls < MAX_SCROLL_CASES) return (scrolls++, "scroll_case");
    return "wall";
  };
  const kinds = new Map(items.map((i) => [i, kindOf(i)]));
  const wallItems = items.filter((i) => kinds.get(i) === "wall");
  const caseItems = items.filter((i) => kinds.get(i) !== "wall").map((i) => ({ ...i, displayMode: kinds.get(i) }));

  // Anchor: the largest wall work that fits the end wall, if it is substantial.
  let anchor: HangInput | null = null;
  for (const item of wallItems) {
    const area = cmToM(item.widthCm) * cmToM(item.heightCm);
    const best = anchor ? cmToM(anchor.widthCm) * cmToM(anchor.heightCm) : 0;
    if (area > best && cmToM(item.widthCm) <= BASE_ROOM_WIDTH - 2 * DOOR_WIDTH - 1) anchor = item;
  }
  if (anchor && cmToM(anchor.widthCm) * cmToM(anchor.heightCm) < 0.4) anchor = null;
  const sideItems = wallItems.filter((i) => i !== anchor);

  const tallest = Math.max(0, ...wallItems.map((i) => cmToM(i.heightCm)));
  const height = Math.max(4.4, Math.min(7, tallest + 1.4));

  // Earlier works hang on the north wall, later ones on the south: one chronological loop.
  const [north, south] = splitBalanced(toColumns(sideItems));

  const caseSlots = caseItems.map((c) => (c.displayMode === "scroll_case" ? cmToM(c.widthCm) + 0.6 : 1.4));
  const caseRun = caseSlots.reduce((a, b) => a + b, 0) + Math.max(0, caseSlots.length - 1) * 1.6;
  const longestWall = Math.max(wallRunLength(north), wallRunLength(south));
  const length = Math.max(MIN_ROOM_LENGTH, longestWall + 2 * END_MARGIN, caseRun + 2 * END_MARGIN + 2);
  const width = caseItems.length ? BASE_ROOM_WIDTH + 1.5 : BASE_ROOM_WIDTH;
  const halfZ = width / 2 - 0.02; // just in front of the wall surface

  const placements: Placement[] = [
    ...hangRun(north, "north", -halfZ, 1, height),
    ...hangRun(south, "south", halfZ, -1, height),
  ];
  if (anchor) {
    const w = cmToM(anchor.widthCm);
    const h = cmToM(anchor.heightCm);
    placements.push({
      id: anchor.id,
      kind: "wall",
      position: [length / 2 - 0.02, verticalCenter(h, height), 0],
      rotationY: -Math.PI / 2,
      widthM: w,
      heightM: h,
      wall: "east",
    });
  }

  // Cases run down the middle, alternating which side they face.
  const obstacles: Room["obstacles"] = [];
  let cx = -caseRun / 2;
  caseItems.forEach((c, i) => {
    const slot = caseSlots[i];
    const x = cx + slot / 2;
    cx += slot + 1.6;
    const w = cmToM(c.widthCm);
    const h = cmToM(c.heightCm);
    placements.push({
      id: c.id,
      kind: c.displayMode as DisplayKind,
      position: [x, 0.95, 0],
      rotationY: i % 2 === 0 ? 0 : Math.PI,
      widthM: w,
      heightM: h,
      wall: "center",
    });
    obstacles.push([x, 0, slot / 2 + 0.15, 0.75]);
  });

  // Entrance door centered on the west wall; the exit sits beside the anchor.
  const doors: Door[] = [
    { side: "west", position: [-length / 2 + 0.01, DOOR_HEIGHT / 2, 0], rotationY: Math.PI / 2 },
    {
      side: "east",
      position: [length / 2 - 0.01, DOOR_HEIGHT / 2, anchor ? width / 2 - DOOR_WIDTH / 2 - 0.6 : 0],
      rotationY: -Math.PI / 2,
    },
  ];

  const bench: Room["bench"] = caseItems.length ? null : [length / 2 - 4.5, 0, 0];
  if (bench) obstacles.push([bench[0], bench[2], 1.0, 0.35]);

  return { length, width, height, placements, doors, obstacles, bench };
}

/**
 * Fits the photographed image inside the measured box without stretching.
 * If the photo's aspect differs from the measurement (frame, crop, border),
 * the image keeps its own aspect and the result is flagged.
 */
export function fitImage(
  box: { widthM: number; heightM: number },
  pixels: { width: number; height: number } | null,
): { widthM: number; heightM: number; mismatch: boolean } {
  if (!pixels || pixels.width <= 0 || pixels.height <= 0) return { ...box, mismatch: false };
  const boxAspect = box.widthM / box.heightM;
  const imageAspect = pixels.width / pixels.height;
  const mismatch = Math.abs(imageAspect / boxAspect - 1) > ASPECT_TOLERANCE;
  if (!mismatch) return { ...box, mismatch };
  return imageAspect > boxAspect
    ? { widthM: box.widthM, heightM: box.widthM / imageAspect, mismatch }
    : { widthM: box.heightM * imageAspect, heightM: box.heightM, mismatch };
}

/** Keeps the visitor inside the room, away from the walls. */
export function clampToRoom(x: number, z: number, room: Pick<Room, "length" | "width">, margin = 0.6) {
  const hx = room.length / 2 - margin;
  const hz = room.width / 2 - margin;
  return { x: Math.min(hx, Math.max(-hx, x)), z: Math.min(hz, Math.max(-hz, z)) };
}

/** True when a point is inside any obstacle footprint (cases, bench), with a body margin. */
export function hitsObstacle(x: number, z: number, obstacles: Room["obstacles"], margin = 0.35) {
  return obstacles.some(([ox, oz, hx, hz]) => Math.abs(x - ox) < hx + margin && Math.abs(z - oz) < hz + margin);
}
