import { describe, expect, it } from "vitest";
import { frameFor, paletteFor } from "./palette";

describe("paletteFor", () => {
  it("gives Old Masters, East Asian, and modern rooms their traditional tones", () => {
    expect(paletteFor("italy", 1600).wall).toBe("#6e2a2a");
    expect(paletteFor("low-countries", 1600).wall).toBe("#2f4a3c");
    expect(paletteFor("china", 1368).wall).toBe("#5b5f5c");
    expect(paletteFor("france", 1900).wall).toBe("#ecebe7");
    expect(paletteFor("italy", Infinity).wall).toBe("#6e2a2a");
  });
});

describe("frameFor", () => {
  const base = { heightM: 1, widthM: 1, kind: "wall" };
  it("frames by tradition", () => {
    expect(frameFor({ ...base, region: "italy", year: 1606 })).toBe("gilt");
    expect(frameFor({ ...base, region: "north-america", year: 1780 })).toBe("walnut");
    expect(frameFor({ ...base, region: "japan", year: 1700, heightM: 1.5, widthM: 0.5 })).toBe("scroll");
    expect(frameFor({ ...base, region: "france", year: 1925 })).toBe("black");
    expect(frameFor({ ...base, region: "italy", year: 1500, kind: "case" })).toBe("none");
    expect(frameFor({ ...base, region: "france", year: 1500, textile: true })).toBe("none");
  });
});
