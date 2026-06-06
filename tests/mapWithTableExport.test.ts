import { describe, it } from "node:test";
import expect from "expect";
import {
  extractDescriptionExcerpt,
  joinBasenames,
  computeSubdivisions,
  enumerateSections,
} from "../src/export/exporters/mapWithTable";

describe("extractDescriptionExcerpt", () => {
  it("returns empty string when no description section exists", () => {
    expect(extractDescriptionExcerpt(new Map())).toBe("");
  });

  it("returns the first paragraph only", () => {
    const text = new Map([
      ["description", "First sentence.\n\nSecond paragraph."],
    ]);
    expect(extractDescriptionExcerpt(text)).toBe("First sentence.");
  });

  it("collapses internal whitespace", () => {
    const text = new Map([["description", "Line one\nLine two\nLine three"]]);
    expect(extractDescriptionExcerpt(text)).toBe("Line one Line two Line three");
  });

  it("strips wikilink syntax down to the basename", () => {
    const text = new Map([
      ["description", "Visit [[towns/Saltwatch]] then [[Old Spire]]."],
    ]);
    expect(extractDescriptionExcerpt(text)).toBe(
      "Visit Saltwatch then Old Spire.",
    );
  });

  it("uses the alias when present in a wikilink", () => {
    const text = new Map([
      ["description", "The [[towns/Saltwatch|fishing town]] sits below."],
    ]);
    expect(extractDescriptionExcerpt(text)).toBe(
      "The fishing town sits below.",
    );
  });

  it("truncates with an ellipsis when the excerpt exceeds 140 chars", () => {
    const longText = "A".repeat(200);
    const text = new Map([["description", longText]]);
    const result = extractDescriptionExcerpt(text);
    expect(result.length).toBeLessThanOrEqual(140);
    expect(result.endsWith("…")).toBe(true);
  });
});

describe("joinBasenames", () => {
  it("returns empty string for undefined / empty input", () => {
    expect(joinBasenames(undefined)).toBe("");
    expect(joinBasenames([])).toBe("");
  });

  it("joins basenames with comma + space", () => {
    expect(joinBasenames(["Saltwatch", "Old Spire"])).toBe(
      "Saltwatch, Old Spire",
    );
  });

  it("strips path prefixes", () => {
    expect(joinBasenames(["dungeons/path/Goblin Lair"])).toBe("Goblin Lair");
  });

  it("strips .md suffixes", () => {
    expect(joinBasenames(["Saltwatch.md"])).toBe("Saltwatch");
  });
});

describe("computeSubdivisions", () => {
  it("returns 1×1 for a small map that fits in one page", () => {
    // 10 cols × 6 rows; at 60px hex, page fits 15 cols × ~7 rows max → 1×1
    const layout = computeSubdivisions({
      gridCols: 10,
      gridRows: 6,
      pageWidthPx: 900,
      pageHeightPx: 400,
      minHexPxOnPage: 60,
    });
    expect(layout.colSections).toBe(1);
    expect(layout.rowSections).toBe(1);
  });

  it("subdivides when the map is too big to fit hexes at min size on one page", () => {
    // 30 cols × 20 rows; at 60px hex, page fits 15 cols × ~7 rows max
    // so cols need 2 sections, rows need 3 sections
    const layout = computeSubdivisions({
      gridCols: 30,
      gridRows: 20,
      pageWidthPx: 900,
      pageHeightPx: 360,
      minHexPxOnPage: 60,
    });
    expect(layout.colSections).toBeGreaterThanOrEqual(2);
    expect(layout.rowSections).toBeGreaterThanOrEqual(3);
  });

  it("never returns a count of 0 (degenerate inputs)", () => {
    const layout = computeSubdivisions({
      gridCols: 0,
      gridRows: 0,
      pageWidthPx: 900,
      pageHeightPx: 400,
      minHexPxOnPage: 60,
    });
    expect(layout.colSections).toBe(1);
    expect(layout.rowSections).toBe(1);
  });

  it("hexesPerSection covers the full grid when multiplied by section count", () => {
    const layout = computeSubdivisions({
      gridCols: 25,
      gridRows: 17,
      pageWidthPx: 900,
      pageHeightPx: 360,
      minHexPxOnPage: 60,
    });
    expect(layout.colSections * layout.hexesPerSectionCol).toBeGreaterThanOrEqual(25);
    expect(layout.rowSections * layout.hexesPerSectionRow).toBeGreaterThanOrEqual(17);
  });
});

describe("enumerateSections", () => {
  it("yields a single section for a 1×1 layout", () => {
    const sections = enumerateSections(
      {
        colSections: 1,
        rowSections: 1,
        hexesPerSectionCol: 10,
        hexesPerSectionRow: 8,
      },
      { cols: 10, rows: 8 },
    );
    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe("A1");
    expect(sections[0].colStart).toBe(0);
    expect(sections[0].colEnd).toBe(10);
    expect(sections[0].rowStart).toBe(0);
    expect(sections[0].rowEnd).toBe(8);
  });

  it("labels columns A,B,C and rows 1,2,3 in row-major order", () => {
    const sections = enumerateSections(
      {
        colSections: 3,
        rowSections: 2,
        hexesPerSectionCol: 10,
        hexesPerSectionRow: 5,
      },
      { cols: 30, rows: 10 },
    );
    const labels = sections.map((s) => s.label);
    expect(labels).toEqual(["A1", "B1", "C1", "A2", "B2", "C2"]);
  });

  it("clips the last section's end at the grid boundary", () => {
    const sections = enumerateSections(
      {
        colSections: 3,
        rowSections: 1,
        hexesPerSectionCol: 10,
        hexesPerSectionRow: 8,
      },
      { cols: 25, rows: 8 }, // 25 cols across 3 sections → last is 5 wide
    );
    expect(sections).toHaveLength(3);
    expect(sections[2].colStart).toBe(20);
    expect(sections[2].colEnd).toBe(25);
  });
});
