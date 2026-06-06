/**
 * End-to-end integration test for the single-hex exporter (1.5).
 * Drives the real `exportHexAsMarkdown` + `buildHexMarkdown` against
 * the simulated vault.
 */

import { describe, it, before, after } from "node:test";
import expect from "expect";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { MockHexmakerPlugin, MockTFile } from "../helpers/simVault";
import {
  buildHexMarkdown,
  exportHexAsMarkdown,
} from "../../src/export/exporters/singleHex";

let tmpDir: string;
let plugin: MockHexmakerPlugin;

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "duckmage-e2e-hex-"));
  plugin = new MockHexmakerPlugin(tmpDir);
});

after(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("e2e: single-hex exporter against sim-vault", () => {
  it("buildHexMarkdown includes every populated section", async () => {
    const file = plugin.app.vault.getAbstractFileByPath(
      "hexes/the-coast/0_0.md",
    );
    expect(file).toBeTruthy();
    const md = await buildHexMarkdown(
      plugin as never,
      file as MockTFile as never,
      { includeGmSections: true },
    );

    // Title + coord + terrain metadata
    expect(md).toMatch(/# 0_0/);
    expect(md).toMatch(/Coordinate:\*\* 0, 0/);
    expect(md).toMatch(/Terrain:\*\* shallows/);

    // Every populated section
    expect(md).toMatch(/## Description/);
    expect(md).toMatch(/## Landmark/);
    expect(md).toMatch(/## Weather/);
    expect(md).toMatch(/## Hooks & Rumors/);
    expect(md).toMatch(/## Hidden/);
    expect(md).toMatch(/## Secret/);
    expect(md).toMatch(/## Towns/);
    expect(md).toMatch(/## Dungeons/);
    expect(md).toMatch(/## Factions/);
    expect(md).toMatch(/## Encounters Table/);

    // Each wrapped in a section block
    const blocks = md.match(/<section class="duckmage-hex-section">/g) ?? [];
    expect(blocks.length).toBeGreaterThanOrEqual(8);
  });

  it("buildHexMarkdown skips empty sections", async () => {
    const file = plugin.app.vault.getAbstractFileByPath(
      "hexes/the-coast/1_0.md",
    );
    const md = await buildHexMarkdown(
      plugin as never,
      file as MockTFile as never,
    );
    expect(md).toMatch(/## Description/);
    expect(md).toMatch(/## Features/);
    expect(md).toMatch(/## Quests/);
    // 1_0.md has no Towns / Dungeons / Encounters — should NOT appear
    expect(md).not.toMatch(/## Towns/);
    expect(md).not.toMatch(/## Dungeons/);
    expect(md).not.toMatch(/## Encounters Table/);
  });

  it("excludes GM-only sections by default", async () => {
    const file = plugin.app.vault.getAbstractFileByPath(
      "hexes/the-coast/0_0.md",
    );
    const md = await buildHexMarkdown(
      plugin as never,
      file as MockTFile as never,
    );
    // includeGmSections defaults to false
    expect(md).not.toMatch(/## Hidden/);
    expect(md).not.toMatch(/## Secret/);
    // Non-GM sections still present
    expect(md).toMatch(/## Description/);
  });

  it("handles a nearly-empty hex without crashing", async () => {
    const file = plugin.app.vault.getAbstractFileByPath(
      "hexes/the-coast/2_0.md",
    );
    const md = await buildHexMarkdown(
      plugin as never,
      file as MockTFile as never,
    );
    // Only terrain frontmatter — title + terrain metadata, no sections
    expect(md).toMatch(/# 2_0/);
    expect(md).toMatch(/Terrain:\*\* mountain/);
    expect(md).not.toMatch(/<section class="duckmage-hex-section">/);
  });

  it("writes the markdown export to the configured folder", async () => {
    const file = plugin.app.vault.getAbstractFileByPath(
      "hexes/the-coast/1_1.md",
    );
    await exportHexAsMarkdown(plugin as never, file as MockTFile as never);
    const out = await fs.readFile(
      path.join(tmpDir, "exports/1_1.md"),
      "utf8",
    );
    expect(out).toMatch(/# 1_1/);
    expect(out).toMatch(/## Description/);
    expect(out).toMatch(/Rolling pastureland/);
  });
});
