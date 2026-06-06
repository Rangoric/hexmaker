import { describe, it } from "node:test";
import expect from "expect";
import {
  fillTemplate,
  formatRollsBreakdown,
} from "../src/export/exporters/workflow";
import type { Workflow } from "../src/random-tables/workflow";

const wf = (steps: Workflow["steps"]): Workflow => ({
  name: "test",
  steps,
});

describe("fillTemplate", () => {
  it("returns empty string when template is empty", () => {
    expect(fillTemplate("", wf([]), [])).toBe("");
  });

  it("returns unchanged template when no steps", () => {
    expect(fillTemplate("Hello world", wf([]), [])).toBe("Hello world");
  });

  it("substitutes $label placeholder for single-roll table step", () => {
    const w = wf([
      { kind: "table", tablePath: "monsters", rolls: 1, label: "monster" },
    ]);
    expect(fillTemplate("A $monster appears.", w, [["wolf"]])).toBe(
      "A wolf appears.",
    );
  });

  it("substitutes $label_1, $label_2 for multi-roll step", () => {
    const w = wf([
      { kind: "table", tablePath: "names", rolls: 2, label: "name" },
    ]);
    expect(fillTemplate("$name_1 and $name_2", w, [["Alice", "Bob"]])).toBe(
      "Alice and Bob",
    );
  });

  it("substitutes table-basename placeholder when no label", () => {
    const w = wf([
      { kind: "table", tablePath: "folder/monsters", rolls: 1 },
    ]);
    expect(fillTemplate("Foe: $monsters", w, [["goblin"]])).toBe(
      "Foe: goblin",
    );
  });

  it("substitutes dice-formula step with the rolled value", () => {
    const w = wf([
      { kind: "dice", tablePath: "", diceFormula: "2d6+3", rolls: 1, label: "hp" },
    ]);
    expect(fillTemplate("HP: $hp", w, [["(4+5)+3=12"]])).toBe(
      "HP: (4+5)+3=12",
    );
  });

  it("leaves unmatched placeholders as [$placeholder] when no roll provided", () => {
    const w = wf([
      { kind: "table", tablePath: "x", rolls: 1, label: "name" },
    ]);
    expect(fillTemplate("$name", w, [[]])).toBe("[$name]");
  });

  it("handles spaces in labels (placeholder uses underscores)", () => {
    const w = wf([
      { kind: "table", tablePath: "x", rolls: 1, label: "true name" },
    ]);
    // stepVarName turns space → underscore: $true_name
    expect(fillTemplate("$true_name", w, [["Vargax"]])).toBe("Vargax");
  });
});

describe("formatRollsBreakdown", () => {
  it("returns empty array when there are no steps", () => {
    expect(formatRollsBreakdown(wf([]), [])).toEqual([]);
  });

  it("renders a header row + one row per roll", () => {
    const w = wf([
      { kind: "table", tablePath: "monsters", rolls: 1, label: "monster" },
      { kind: "dice", tablePath: "", diceFormula: "2d6", rolls: 2, label: "hp" },
    ]);
    const out = formatRollsBreakdown(w, [["wolf"], ["7", "11"]]);
    expect(out[0]).toBe("| Step | Label | Roll | Value |");
    expect(out[1]).toMatch(/^\|\s*---/);
    // Step 1, single roll → "—"
    expect(out[2]).toBe("| 1 | monster | — | wolf |");
    // Step 2, two rolls
    expect(out[3]).toBe("| 2 | hp | 1 | 7 |");
    expect(out[4]).toBe("| 2 | hp | 2 | 11 |");
  });

  it("falls back to table basename when no label is set", () => {
    const w = wf([
      { kind: "table", tablePath: "monsters/forest/wolves", rolls: 1 },
    ]);
    const out = formatRollsBreakdown(w, [["alpha wolf"]]);
    expect(out[2]).toBe("| 1 | wolves | — | alpha wolf |");
  });

  it("falls back to dice formula when no label is set", () => {
    const w = wf([{ kind: "dice", tablePath: "", diceFormula: "1d20", rolls: 1 }]);
    const out = formatRollsBreakdown(w, [["17"]]);
    expect(out[2]).toBe("| 1 | 1d20 | — | 17 |");
  });

  it("escapes pipes in rolled values", () => {
    const w = wf([{ kind: "table", tablePath: "x", rolls: 1, label: "thing" }]);
    const out = formatRollsBreakdown(w, [["left | right"]]);
    expect(out[2]).toMatch(/left \\\| right/);
  });
});
