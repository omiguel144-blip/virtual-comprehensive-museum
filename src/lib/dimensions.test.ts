import { describe, expect, it } from "vitest";
import { century, parseDimensions, parseYears } from "./dimensions";

describe("parseDimensions", () => {
  it("prefers the cm value in a Met-style string", () => {
    const d = parseDimensions("36 x 60 in. (91.4 x 152.4 cm)");
    expect(d).toMatchObject({ heightCm: 91.4, widthCm: 152.4, confidence: "measured" });
  });

  it("converts inches with fractions when no cm is given", () => {
    const d = parseDimensions("36 1/4 x 60 in.");
    expect(d?.heightCm).toBeCloseTo(92.1, 1);
    expect(d?.widthCm).toBeCloseTo(152.4, 1);
  });

  it("skips framed measurements in favor of the painting", () => {
    const d = parseDimensions(
      "Framed: 120 x 180 x 10 cm (47 1/4 x 70 7/8 x 3 15/16 in.)\nUnframed: 91.5 x 151.8 cm (36 x 59 3/4 in.)",
    );
    expect(d).toMatchObject({ heightCm: 91.5, widthCm: 151.8, confidence: "measured" });
    expect(d?.source).toMatch(/Unframed/);
  });

  it("treats the Met's Image: label as the painted surface", () => {
    const d = parseDimensions("Image: 59 1/4 × 80 3/4 in. (150.5 × 205.1 cm)\nFramed: 70 × 91 in. (177.8 × 231.1 cm)");
    expect(d).toMatchObject({ heightCm: 150.5, widthCm: 205.1, confidence: "measured" });
  });

  it("flags framed-only measurements as estimated", () => {
    const d = parseDimensions("Framed: 120 x 180 cm");
    expect(d).toMatchObject({ heightCm: 120, widthCm: 180, confidence: "estimated" });
  });

  it("returns null for missing or unparseable input", () => {
    expect(parseDimensions(null)).toBeNull();
    expect(parseDimensions("Dimensions unavailable")).toBeNull();
  });
});

describe("parseYears / century", () => {
  it("parses begin and end dates", () => {
    expect(parseYears(1665, "1667")).toEqual({ yearStart: 1665, yearEnd: 1667 });
    expect(parseYears("1889", null)).toEqual({ yearStart: 1889, yearEnd: 1889 });
    expect(parseYears(null, null)).toEqual({ yearStart: null, yearEnd: null });
  });

  it("maps years to centuries", () => {
    expect(century(1889)).toBe(19);
    expect(century(1900)).toBe(19);
    expect(century(1901)).toBe(20);
    expect(century(-50)).toBe(-1);
  });
});
