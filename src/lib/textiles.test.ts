import { describe, expect, it } from "vitest";
import { isDisplayTextile } from "./textiles";

describe("isDisplayTextile", () => {
  it("accepts large tapestries, hangings, rugs and coverlets", () => {
    expect(isDisplayTextile("Tapestry The Hunt", "Overall: 380 x 420 cm")).toBe(true);
    expect(isDisplayTextile("Rug", "179.7 × 90 cm (70 3/4 × 35 3/8 in.)")).toBe(true);
    expect(isDisplayTextile("Coverlet", "251.8 × 184 cm")).toBe(true);
  });

  it("rejects fragments, samples, upholstery, small pieces, and other types", () => {
    expect(isDisplayTextile("Tapestry fragment", "300 x 200 cm")).toBe(false);
    expect(isDisplayTextile("Upholstery panel", "120 x 60 cm")).toBe(false);
    expect(isDisplayTextile("Rug", "40 x 30 cm")).toBe(false);
    expect(isDisplayTextile("Dress", "150 x 60 cm")).toBe(false);
    expect(isDisplayTextile("Hanging", null)).toBe(false);
  });
});
