import { describe, expect, it } from "vitest";
import { clampToRoom, cmToM, EYE_LEVEL, fitImage, GAP, layoutRoom, ROOM_WIDTH } from "./gallery-layout";

describe("life-scale sizing", () => {
  it("converts centimeters to meters (1 unit = 1 m)", () => {
    expect(cmToM(91.5)).toBeCloseTo(0.92, 2);
    expect(cmToM(151.8)).toBeCloseTo(1.52, 2);
  });

  it("sizes each painting from its physical dimensions", () => {
    const room = layoutRoom([{ id: 1, heightCm: 91.5, widthCm: 151.8 }]);
    expect(room.placements[0]).toMatchObject({ widthM: 1.52, heightM: 0.92 });
    expect(room.placements[0].position[1]).toBe(EYE_LEVEL);
  });
});

describe("layoutRoom", () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, heightCm: 100, widthCm: 80 + i * 10 }));
  const room = layoutRoom(items);

  it("hangs every painting on one of the two long walls", () => {
    expect(room.placements).toHaveLength(10);
    for (const p of room.placements) expect(Math.abs(p.position[2])).toBeCloseTo(ROOM_WIDTH / 2 - 0.02);
  });

  it("never overlaps paintings on the same wall", () => {
    for (const z of [-1, 1]) {
      const wall = room.placements
        .filter((p) => Math.sign(p.position[2]) === z)
        .sort((a, b) => a.position[0] - b.position[0]);
      for (let i = 1; i < wall.length; i++) {
        const gap = wall[i].position[0] - wall[i].widthM / 2 - (wall[i - 1].position[0] + wall[i - 1].widthM / 2);
        expect(gap).toBeGreaterThanOrEqual(GAP - 1e-9);
      }
    }
  });

  it("keeps all paintings inside the room length", () => {
    for (const p of room.placements) expect(Math.abs(p.position[0]) + p.widthM / 2).toBeLessThan(room.length / 2);
  });

  it("lifts very tall paintings off the floor and keeps them under the ceiling", () => {
    const [tall] = layoutRoom([{ id: 1, heightCm: 380, widthCm: 200 }]).placements;
    expect(tall.position[1] - tall.heightM / 2).toBeGreaterThan(0);
    expect(tall.position[1] + tall.heightM / 2).toBeLessThanOrEqual(room.height);
  });
});

describe("fitImage", () => {
  const box = { widthM: 1.5, heightM: 1 };

  it("uses the measured size when the photo matches", () => {
    expect(fitImage(box, { width: 3000, height: 2000 })).toEqual({ widthM: 1.5, heightM: 1, mismatch: false });
  });

  it("never stretches: a mismatched photo keeps its own aspect inside the box", () => {
    const wide = fitImage(box, { width: 4000, height: 2000 });
    expect(wide).toMatchObject({ widthM: 1.5, heightM: 0.75, mismatch: true });
    const tall = fitImage(box, { width: 1000, height: 1000 });
    expect(tall).toMatchObject({ widthM: 1, heightM: 1, mismatch: true });
  });

  it("falls back to the box when pixel size is unknown", () => {
    expect(fitImage(box, null)).toEqual({ ...box, mismatch: false });
  });
});

describe("clampToRoom", () => {
  it("keeps the visitor away from walls", () => {
    expect(clampToRoom(100, -100, { length: 20, width: 9 })).toEqual({ x: 9.4, z: -3.9 });
    expect(clampToRoom(1, 1, { length: 20, width: 9 })).toEqual({ x: 1, z: 1 });
  });
});
