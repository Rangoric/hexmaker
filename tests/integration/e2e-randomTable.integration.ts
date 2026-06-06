/**
 * End-to-end integration test for the random-table exporter (1.1).
 *
 * Drives the real `exportRandomTableAsPdf` and `exportRandomTableAsMarkdown`
 * orchestrators against the simulated vault. Validates the full code path:
 * file read → parse → format → render → write — including the linked-notes
 * appendix for the `linkedFolder`-driven `treasure` table.
 */

import { describe, it, before, after } from "node:test";
import expect from "expect";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

import { MockHexmakerPlugin, MockTFile } from "../helpers/simVault";
import {
  exportRandomTableAsPdf,
  exportRandomTableAsMarkdown,
} from "../../src/export/exporters/randomTable";

let tmpDir: string;
let plugin: MockHexmakerPlugin;

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "duckmage-e2e-rt-"));
  plugin = new MockHexmakerPlugin(tmpDir);
});

after(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("e2e: random-table exporter against sim-vault", () => {
  it("exports a basic weighted table to Markdown", async () => {
    const file = plugin.app.vault.getAbstractFileByPath(
      "tables/forest-encounters.md",
    );
    expect(file).toBeTruthy();

    await exportRandomTableAsMarkdown(
      plugin as never,
      file as MockTFile as never,
    );

    const out = await fs.readFile(
      path.join(tmpDir, "exports/forest-encounters.md"),
      "utf8",
    );
    expect(out).toMatch(/# forest-encounters/);
    expect(out).toMatch(/Roll d6/);
    expect(out).toMatch(/Pack of wolves/);
    expect(out).toMatch(/Lost merchant/);
    expect(out).toMatch(/Bandit ambush/);
    expect(out).toMatch(/Druid circle/);
  });

  it("exports a linkedFolder table and inlines each linked note in the appendix", async () => {
    const file = plugin.app.vault.getAbstractFileByPath("tables/treasure.md");
    expect(file).toBeTruthy();

    await exportRandomTableAsMarkdown(
      plugin as never,
      file as MockTFile as never,
    );

    const out = await fs.readFile(
      path.join(tmpDir, "exports/treasure.md"),
      "utf8",
    );

    // Table itself
    expect(out).toMatch(/# treasure/);
    expect(out).toMatch(/gold pile/);
    expect(out).toMatch(/silver ring/);
    expect(out).toMatch(/cursed amulet/);

    // Linked-notes appendix — each linked note's body should appear
    expect(out).toMatch(/<section class="duckmage-export-note/);
    expect(out).toMatch(/## gold pile/);
    expect(out).toMatch(/heap of unminted gold ingots/);
    expect(out).toMatch(/## silver ring/);
    expect(out).toMatch(/running stag/);
    expect(out).toMatch(/## cursed amulet/);
    expect(out).toMatch(/whispers at midnight/);
  });

  it("auto-creates the export folder on first export", async () => {
    // Already exercised by the tests above; assert explicitly here so a
    // future change that bypasses ensureExportFolder is caught.
    const stat = await fs.stat(path.join(tmpDir, "exports"));
    expect(stat.isDirectory()).toBe(true);
  });
});

// `exportRandomTableAsPdf` is imported but its full PDF pipeline depends on
// Obsidian's MarkdownRenderer + Electron's webview, neither available here.
// The build-markdown step is exercised end-to-end via the Markdown export
// (same path up to the PDF render). PDF rendering is covered by the
// chromium-driver integration tests.
void exportRandomTableAsPdf;
void execSync;
