import { describe, expect, it } from "vitest";
import { classifyRegion, parseGalleryKey, periodFor, periodLabel } from "./regions";

describe("classifyRegion with real museum strings", () => {
  it.each([
    // Met culture / department / nationality
    [{ culture: "China, Ming dynasty (1368–1644)" }, "china"],
    [{ culture: "Mughal India, court of Akbar (reigned 1556–1605)" }, "south-asia"],
    [{ culture: "Japan, Edo period (1615–1868)" }, "japan"],
    [{ culture: "Korea, Joseon dynasty (1392–1910)" }, "korea"],
    [{ culture: "Western India, Gujarat, last quarter of the 15th century" }, "south-asia"],
    [{ culture: "Eastern India, Bengal, Kolkata, Kalighat" }, "south-asia"],
    [{ culture: "Iran, Isfahan, Safavid period" }, "islamic"],
    [{ culture: "Tibet" }, "himalaya-sea"],
    [{ culture: "Peru, Cuzco" }, "latin-america"],
    [{ culture: "", nationality: "Italian", department: "European Paintings" }, "italy"],
    [{ nationality: "Dutch", department: "European Paintings" }, "low-countries"],
    [{ nationality: "Flemish" }, "low-countries"],
    [{ nationality: "Spanish" }, "iberia"],
    [{ nationality: "British" }, "britain"],
    [{ nationality: "American", department: "The American Wing" }, "north-america"],
    [{ department: "The American Wing" }, "north-america"],
    // AIC place_of_origin / artist_display second line
    [{ place: "France" }, "france"],
    [{ place: "United States", nationality: "American, 1928-1987" }, "north-america"],
    [{ nationality: "Uruguayan, 1874–1949" }, "latin-america"],
    [{ nationality: "South African, born 1955" }, "africa"],
    [{ nationality: "Montenegrin, 1933–2010" }, "nordic-east"],
    [{ place: "Puri", nationality: "Odisha, Puri", department: "Arts of Asia" }, "unassigned"],
    // CMA culture / department
    [{ culture: "France, 19th century" }, "france"],
    [{ culture: "America, Ohio, Cleveland" }, "north-america"],
    [{ culture: "China, Southern Song dynasty (1127-1279)" }, "china"],
    [{ department: "Chinese Art" }, "china"],
    [{ department: "Japanese Art" }, "japan"],
    [{ department: "Indian and Southeast Asian Art" }, "south-asia"],
    [{ culture: "Latin America", nationality: "Spanish" }, "latin-america"],
  ] as const)("%o -> %s", (hints, region) => {
    expect(classifyRegion(hints)).toBe(region);
  });

  it("treats 'Roman' as ancient only before 600 CE", () => {
    expect(classifyRegion({ culture: "Roman", yearStart: 150 })).toBe("ancient");
    expect(classifyRegion({ culture: "Roman", yearStart: 1650 })).toBe("italy");
    expect(classifyRegion({ culture: "Byzantine" })).toBe("ancient");
  });

  it("never guesses without evidence", () => {
    expect(classifyRegion({})).toBe("unassigned");
    expect(classifyRegion({ department: "Modern Art" })).toBe("unassigned");
  });

  it("does not confuse the US state Georgia with the country", () => {
    expect(classifyRegion({ culture: "Georgia", nationality: "American" })).toBe("north-america");
  });
});

describe("periods", () => {
  it("uses dynasties and eras for East Asia", () => {
    expect(periodFor("china", 1500)).toMatchObject({ key: "1368", label: "Ming Dynasty (1368–1644)" });
    expect(periodFor("china", 1100)).toMatchObject({ label: "Song Dynasty (960–1279)" });
    expect(periodFor("japan", 1700).label).toBe("Edo Period (1615–1868)");
    expect(periodFor("korea", 1500).label).toBe("Joseon Dynasty (1392–1910)");
  });

  it("uses art-historical bands for Europe", () => {
    expect(periodFor("italy", 1606)).toMatchObject({ key: "1600", label: "17th Century" });
    expect(periodFor("italy", 1500).label).toBe("Renaissance, 1450–1600");
    expect(periodFor("france", 1250)).toMatchObject({ key: "early", label: "Medieval (before 1300)" });
  });

  it("handles undated works and round-trips keys", () => {
    expect(periodFor("italy", null).key).toBe("undated");
    expect(periodLabel("china", "1368")).toBe("Ming Dynasty (1368–1644)");
    expect(periodLabel("italy", "early")).toBe("Medieval (before 1300)");
    expect(parseGalleryKey("low-countries:1600")).toEqual({ region: "low-countries", period: "1600" });
    expect(parseGalleryKey("bad key")).toBeNull();
  });
});
