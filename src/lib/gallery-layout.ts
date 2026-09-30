/**
 * Pure layout math for the 3D gallery. Units are meters: 1 scene unit = 1 m.
 * Paintings hang on the two long walls, centered at eye level, with their
 * size taken from the museum's physical measurements.
 */

export const EYE_LEVEL = 1.55;
export const WALL_HEIGHT = 4.2;
export const ROOM_WIDTH = 9;
export const GAP = 1.4;
export const END_MARGIN = 2.2;
/** How far image and measured aspect ratios may differ before we flag it. */
export const ASPECT_TOLERANCE = 0.06;

export type HangInput = { id: number; heightCm: number; widthCm: number };

export type Placement = {
  id: number;
  /** Center of the painting in world space. */
  position: [number, number, number];
  /** Y rotation so the painting faces into the room. */
  rotationY: number;
  /** Physical size of the painted surface in meters. */
  widthM: number;
  heightM: number;
};

export type Room = { length: number; width: number; height: number; placements: Placement[] };

export const cmToM = (cm: number) => Math.round(cm) / 100;

function hangWall(items: HangInput[], z: number, rotationY: number, direction: 1 | -1): Placement[] {
  const used = items.reduce((sum, p) => sum + cmToM(p.widthCm), 0) + GAP * Math.max(items.length - 1, 0);
  let cursor = -used / 2;
  return items.map((item) => {
    const widthM = cmToM(item.widthCm);
    const heightM = cmToM(item.heightCm);
    const x = (cursor + widthM / 2) * direction;
    cursor += widthM + GAP;
    // Very tall works are raised so their bottom edge clears the floor.
    const y = Math.max(EYE_LEVEL, heightM / 2 + 0.3);
    return {
      id: item.id,
      position: [x, Math.min(y, WALL_HEIGHT - heightM / 2 - 0.1), z] as [number, number, number],
      rotationY,
      widthM,
      heightM,
    };
  });
}

/** Splits paintings across the two long walls, alternating to balance width. */
export function layoutRoom(items: HangInput[]): Room {
  const north: HangInput[] = [];
  const south: HangInput[] = [];
  let northWidth = 0;
  let southWidth = 0;
  for (const item of items) {
    const w = cmToM(item.widthCm);
    if (northWidth <= southWidth) {
      north.push(item);
      northWidth += w + GAP;
    } else {
      south.push(item);
      southWidth += w + GAP;
    }
  }
  const longest = Math.max(northWidth, southWidth) - GAP;
  const length = Math.max(12, longest + END_MARGIN * 2);
  const half = ROOM_WIDTH / 2 - 0.02; // just in front of the wall surface
  return {
    length,
    width: ROOM_WIDTH,
    height: WALL_HEIGHT,
    placements: [
      // North wall (z = -half) faces +z; hang left to right as seen from the room.
      ...hangWall(north, -half, 0, 1),
      // South wall faces -z; mirror x so reading order stays left to right.
      ...hangWall(south, half, Math.PI, -1),
    ],
  };
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
