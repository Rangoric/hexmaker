import { describe, it } from "node:test";
import expect from "expect";
import {
  parseHexCoord,
  renderSectionBlock,
  HEX_SECTIONS,
  type HexSectionDef,
} from "../src/export/exporters/singleHex";

describe("parseHexCoord", () => {
  it("parses simple positive coords", () => {
    expect(parseHexCoord("5_3")).toEqual({ x: 5, y: 3 });
  });

  it("parses negative coords", () => {
    expect(parseHexCoord("-2_-7")).toEqual({ x: -2, y: -7 });
    expect(parseHexCoord("-2_3")).toEqual({ x: -2, y: 3 });
    expect(parseHexCoord("5_-3")).toEqual({ x: 5, y: -3 });
  });

  it("returns null for non-coord basenames", () => {
    expect(parseHexCoord("my-cool-hex")).toBeNull();
    expect(parseHexCoord("5")).toBeNull();
    expect(parseHexCoord("5_3_extra")).toBeNull();
    expect(parseHexCoord("")).toBeNull();
  });
});

describe("renderSectionBlock", () => {
  const text: HexSectionDef = {
    id: "description",
    title: "Description",
    kind: "text",
  };
  const links: HexSectionDef = {
    id: "towns",
    title: "Towns",
    kind: "links",
  };

  it("returns null for an empty text section", () => {
    const data = { text: new Map(), links: new Map() };
    expect(renderSectionBlock(text, data)).toBeNull();
  });

  it("returns null when the text section is whitespace only", () => {
    const data = {
      text: new Map([["description", "   \n   "]]),
      links: new Map(),
    };
    expect(renderSectionBlock(text, data)).toBeNull();
  });

  it("wraps text content in a section block with heading", () => {
    const data = {
      text: new Map([["description", "A small fishing town."]]),
      links: new Map(),
    };
    const out = renderSectionBlock(text, data);
    expect(out).toMatch(/<section class="duckmage-hex-section">/);
    expect(out).toMatch(/## Description/);
    expect(out).toMatch(/A small fishing town\./);
    expect(out).toMatch(/<\/section>/);
  });

  it("returns null for an empty link section", () => {
    const data = { text: new Map(), links: new Map() };
    expect(renderSectionBlock(links, data)).toBeNull();
  });

  it("renders link sections as a bulleted wikilink list", () => {
    const data = {
      text: new Map(),
      links: new Map([["towns", ["Saltwatch", "Old Spire"]]]),
    };
    const out = renderSectionBlock(links, data);
    expect(out).toMatch(/## Towns/);
    expect(out).toMatch(/- \[\[Saltwatch\]\]/);
    expect(out).toMatch(/- \[\[Old Spire\]\]/);
  });
});

describe("HEX_SECTIONS catalogue", () => {
  it("includes all standard hex sections", () => {
    const ids = HEX_SECTIONS.map((s) => s.id);
    // Core text sections
    expect(ids).toContain("description");
    expect(ids).toContain("landmark");
    expect(ids).toContain("weather");
    expect(ids).toContain("hooks & rumors");
    expect(ids).toContain("hidden");
    expect(ids).toContain("secret");
    // Link sections
    expect(ids).toContain("towns");
    expect(ids).toContain("dungeons");
    expect(ids).toContain("features");
    expect(ids).toContain("quests");
    expect(ids).toContain("factions");
    expect(ids).toContain("encounters table");
  });

  it("marks Hidden and Secret as GM-only", () => {
    const gmOnly = HEX_SECTIONS.filter((s) => s.gmOnly).map((s) => s.id);
    expect(gmOnly).toEqual(["hidden", "secret"]);
  });

  it("text sections come before link sections (semantic ordering)", () => {
    const firstLinksIdx = HEX_SECTIONS.findIndex((s) => s.kind === "links");
    const lastTextIdx = HEX_SECTIONS.map((s, i) => ({ s, i }))
      .filter(({ s }) => s.kind === "text")
      .reduce((max, cur) => Math.max(max, cur.i), -1);
    expect(lastTextIdx).toBeLessThan(firstLinksIdx);
  });
});
