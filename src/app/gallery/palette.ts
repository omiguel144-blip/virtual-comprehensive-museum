/**
 * Room colors and frame styles, following common museum practice: saturated
 * reds and greens behind Old Masters, warm greys for the North, light walls
 * for modern art, and quiet ink tones for East Asian painting.
 */

export type RoomPalette = { wall: string; trim: string; floor: [string, string]; ceiling: string };

const P = (wall: string, trim: string, floor: [string, string] = ["#7a5a3c", "#8b6a48"], ceiling = "#eeeae3"): RoomPalette => ({
  wall,
  trim,
  floor,
  ceiling,
});

const OLD_MASTERS_RED = P("#6e2a2a", "#3d1716");
const BAROQUE_GREEN = P("#2f4a3c", "#1d2e25");
const NORTHERN_GREY = P("#8a8378", "#4f4a43");
const SALON_BLUE = P("#3d4f66", "#26313f");
const WARM_STONE = P("#b8ab97", "#7d715f");
const MODERN_WHITE = P("#ecebe7", "#cfcac2", ["#b9b2a6", "#c6bfb3"], "#f7f6f3");
const INK_GREY = P("#5b5f5c", "#34383a", ["#4e463c", "#5a5146"]);
const INDIGO = P("#3c4560", "#262c3d", ["#4e463c", "#5a5146"]);
const SAFFRON = P("#8c5a2b", "#5a3a1b");
const TERRACOTTA = P("#9a5b45", "#5e372a");

export function paletteFor(region: string, periodStart: number): RoomPalette {
  const year = Number.isFinite(periodStart) ? periodStart : 1700;
  switch (region) {
    case "china":
    case "korea":
      return INK_GREY;
    case "japan":
      return INDIGO;
    case "south-asia":
    case "himalaya-sea":
    case "islamic":
      return SAFFRON;
    case "latin-america":
    case "africa":
      return TERRACOTTA;
    case "ancient":
      return WARM_STONE;
  }
  if (year >= 1900) return MODERN_WHITE;
  if (year >= 1800) return region === "north-america" ? WARM_STONE : SALON_BLUE;
  if (region === "low-countries" || region === "german" || region === "britain" || region === "nordic-east") {
    return year >= 1600 ? BAROQUE_GREEN : NORTHERN_GREY;
  }
  if (region === "north-america") return WARM_STONE;
  return year >= 1600 ? OLD_MASTERS_RED : NORTHERN_GREY;
}

export type FrameStyle = "gilt" | "walnut" | "black" | "scroll" | "none";

/** Frame by tradition: gilt for European oil painting, mounts for East Asian scrolls, none for textiles and cases. */
export function frameFor(opts: { region: string; year: number | null; kind: string; heightM: number; widthM: number; textile?: boolean }): FrameStyle {
  if (opts.kind !== "wall" || opts.textile) return "none";
  const { region } = opts;
  const year = opts.year ?? 1700;
  if (region === "china" || region === "japan" || region === "korea") {
    return opts.heightM > opts.widthM * 1.2 ? "scroll" : "black";
  }
  if (region === "south-asia" || region === "himalaya-sea" || region === "islamic") return "black";
  if (year >= 1910) return "black";
  if (region === "north-america" && year < 1860) return "walnut";
  return "gilt";
}
