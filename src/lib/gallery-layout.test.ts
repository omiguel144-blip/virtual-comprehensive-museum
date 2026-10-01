import { describe, expect, it } from "vitest";
import {
  CENTER_LINE,
  clampToRoom,
  cmToM,
  fitImage,
  gapBetween,
  hitsObstacle,
  layoutRoom,
  type HangInput,
  type Placement,
} from "./gallery-layout";

const work = (id: number, heightCm: number, widthCm: number, displayMode?: HangInput["displayMode"]): HangInput => ({
  id,
  heightCm,
  widthCm,
  displayMode,
});

const onWall = (room: ReturnType<typeof layoutRoom>, wall: Placement["wall"]) =>
  room.placements.filter((p) => p.wall === wall);

describe("life-scale sizing", () => {
  it("converts centimeters to meters (1 unit = 1 m)", () => {
    expect(cmToM(91.5)).toBeCloseTo(0.92, 2);
  });

  it("hangs works on the 1.45 m center line at their measured size", () => {
    const [p] = layoutRoom([work(1, 91.5, 151.8), work(2, 60, 50)]).placements.filter((x) => x.id === 2);
    expect(p).toMatchObject({ widthM: 0.5, heightM: 0.6 });
    expect(p.position[1]).toBe(CENTER_LINE);
  });
});

describe("curatorial hang", () => {
  const items = Array.from({ length: 12 }, (_, i) => work(i + 1, 80 + i * 5, 60 + i * 8));
  items.splice(5, 0, work(99, 250, 300)); // a large altarpiece-scale work
  const room = layoutRoom(items);

  it("puts the largest work alone on the far wall as the sightline anchor", () => {
    expect(onWall(room, "east").map((p) => p.id)).toEqual([99]);
  });

  it("reads chronologically: earlier works on the north wall, later on the south", () => {
    const north = onWall(room, "north").sort((a, b) => a.position[0] - b.position[0]).map((p) => p.id);
    const south = onWall(room, "south").sort((a, b) => b.position[0] - a.position[0]).map((p) => p.id);
    const order = [...north, ...south];
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(Math.max(...north)).toBeLessThan(Math.min(...south));
  });

  it("never overlaps works on a wall and keeps them inside the room", () => {
    for (const wall of ["north", "south"] as const) {
      const ps = onWall(room, wall).sort((a, b) => a.position[0] - b.position[0]);
      for (let i = 1; i < ps.length; i++) {
        const gap = ps[i].position[0] - ps[i].widthM / 2 - (ps[i - 1].position[0] + ps[i - 1].widthM / 2);
        expect(gap).toBeGreaterThanOrEqual(0.6 - 1e-9);
      }
      for (const p of ps) expect(Math.abs(p.position[0]) + p.widthM / 2).toBeLessThan(room.length / 2 - 1);
    }
  });

  it("keeps every work between floor and ceiling", () => {
    const tall = layoutRoom([work(1, 400, 200)]);
    for (const p of [...room.placements, ...tall.placements]) {
      expect(p.position[1] - p.heightM / 2).toBeGreaterThan(0.3);
      expect(p.position[1] + p.heightM / 2).toBeLessThanOrEqual((p === tall.placements[0] ? tall : room).height);
    }
  });

  it("stacks neighboring small works in pairs", () => {
    const r = layoutRoom([work(1, 30, 25), work(2, 28, 22), work(3, 100, 80)]);
    const [a, b] = r.placements.filter((p) => p.id === 1 || p.id === 2);
    expect(a.position[0]).toBeCloseTo(b.position[0]);
    expect(a.position[1]).toBeGreaterThan(b.position[1]);
  });

  it("gives bigger works more breathing room", () => {
    expect(gapBetween(0.3, 0.3)).toBeLessThan(gapBetween(2, 2));
    expect(gapBetween(10, 10)).toBe(1.6);
  });
});

describe("cases, doors, and room size", () => {
  it("puts album leaves and handscrolls in cases down the middle, as obstacles", () => {
    const r = layoutRoom([work(1, 100, 80), work(2, 20, 15, "case"), work(3, 30, 500, "scroll_case")]);
    const cases = r.placements.filter((p) => p.wall === "center");
    expect(cases.map((c) => c.kind)).toEqual(["case", "scroll_case"]);
    for (const c of cases) expect(hitsObstacle(c.position[0], c.position[2], r.obstacles)).toBe(true);
    expect(r.length).toBeGreaterThan(5 + 2);
  });

  it("caps cases per room and hangs the rest on the walls", () => {
    const r = layoutRoom(Array.from({ length: 30 }, (_, i) => work(i, 30, 20, "case")));
    expect(r.placements.filter((p) => p.kind === "case")).toHaveLength(8);
    expect(r.placements.filter((p) => p.kind === "wall")).toHaveLength(22);
    expect(r.length).toBeLessThan(40);
  });

  it("has an entrance and an exit, with the exit beside the anchor", () => {
    const r = layoutRoom([work(1, 200, 250), work(2, 80, 60)]);
    expect(r.doors.map((d) => d.side)).toEqual(["west", "east"]);
    const exit = r.doors[1];
    const anchor = onWall(r, "east")[0];
    expect(Math.abs(exit.position[2] - anchor.position[2])).toBeGreaterThan(anchor.widthM / 2 + 0.8);
  });

  it("grows the room with its contents", () => {
    const small = layoutRoom([work(1, 80, 60)]);
    const big = layoutRoom(Array.from({ length: 30 }, (_, i) => work(i, 100, 120)));
    expect(small.length).toBe(10);
    expect(big.length).toBeGreaterThan(small.length);
  });
});

describe("fitImage", () => {
  const box = { widthM: 1.5, heightM: 1 };

  it("uses the measured size when the photo matches", () => {
    expect(fitImage(box, { width: 3000, height: 2000 })).toEqual({ widthM: 1.5, heightM: 1, mismatch: false });
  });

  it("never stretches: a mismatched photo keeps its own aspect inside the box", () => {
    expect(fitImage(box, { width: 4000, height: 2000 })).toMatchObject({ widthM: 1.5, heightM: 0.75, mismatch: true });
    expect(fitImage(box, { width: 1000, height: 1000 })).toMatchObject({ widthM: 1, heightM: 1, mismatch: true });
  });

  it("falls back to the box when pixel size is unknown", () => {
    expect(fitImage(box, null)).toEqual({ ...box, mismatch: false });
  });
});

describe("movement limits", () => {
  it("keeps the visitor away from walls and out of cases", () => {
    expect(clampToRoom(100, -100, { length: 20, width: 9 })).toEqual({ x: 9.4, z: -3.9 });
    expect(hitsObstacle(0, 0, [[0, 0, 1, 0.5]])).toBe(true);
    expect(hitsObstacle(3, 3, [[0, 0, 1, 0.5]])).toBe(false);
  });
});
