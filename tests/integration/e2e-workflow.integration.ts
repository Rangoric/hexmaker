/**
 * End-to-end integration test for the workflow exporter (1.6).
 * Drives the real `exportWorkflowAsMarkdown` against the simulated vault —
 * exercising workflow parse + template load + N-sample rolls + filename.
 */

import { describe, it, before, after } from "node:test";
import expect from "expect";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { MockHexmakerPlugin, MockTFile } from "../helpers/simVault";
import {
  buildWorkflowMarkdown,
  exportWorkflowAsMarkdown,
} from "../../src/export/exporters/workflow";

let tmpDir: string;
let plugin: MockHexmakerPlugin;

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "duckmage-e2e-wf-"));
  plugin = new MockHexmakerPlugin(tmpDir);
});

after(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("e2e: workflow exporter against sim-vault", () => {
  it("buildWorkflowMarkdown renders steps + template + samples", async () => {
    const file = plugin.app.vault.getAbstractFileByPath(
      "workflows/npc-generator.md",
    );
    expect(file).toBeTruthy();
    const md = await buildWorkflowMarkdown(
      plugin as never,
      file as MockTFile as never,
      { numSamples: 3 },
    );

    expect(md).toMatch(/# npc-generator/);
    expect(md).toMatch(/Generate a random NPC/);
    expect(md).toMatch(/## Steps/);
    // npc-names is the linked table (resolved via metadataCache)
    expect(md).toMatch(/npc-names/);
    expect(md).toMatch(/2d6\+3/);
    // Template appears as fenced code
    expect(md).toMatch(/## Template/);
    expect(md).toMatch(/\$name/);
    expect(md).toMatch(/\$hp/);
    // 3 samples
    expect(md).toMatch(/## Sample outputs/);
    const sampleHeadings = md.match(/### Sample \d+/g) ?? [];
    expect(sampleHeadings).toHaveLength(3);
  });

  it("each rolled sample picks names from the npc-names fixture table", async () => {
    const file = plugin.app.vault.getAbstractFileByPath(
      "workflows/npc-generator.md",
    );
    const md = await buildWorkflowMarkdown(
      plugin as never,
      file as MockTFile as never,
      { numSamples: 6 },
    );
    // The fixture table has Bromund, Lirel, Vargax, Saskia, Olwen — every
    // rolled name must come from that pool. (Probabilistic but with 6 rolls
    // we should always see at least one.)
    const knownNames = ["Bromund", "Lirel", "Vargax", "Saskia", "Olwen"];
    const anyHit = knownNames.some((n) => md.includes(n));
    expect(anyHit).toBe(true);
  });

  it("toggling includeTemplate / includeRollsBreakdown omits those blocks", async () => {
    const file = plugin.app.vault.getAbstractFileByPath(
      "workflows/npc-generator.md",
    );
    const md = await buildWorkflowMarkdown(
      plugin as never,
      file as MockTFile as never,
      {
        numSamples: 1,
        includeTemplate: false,
        includeRollsBreakdown: false,
      },
    );
    expect(md).not.toMatch(/## Template/);
    // No "| Step | Label | Roll | Value |" breakdown row in any sample
    expect(md).not.toMatch(/\| Step \| Label \| Roll \| Value \|/);
    // But the sample heading + filled-template still present
    expect(md).toMatch(/### Sample 1/);
    expect(md).toMatch(/traveller with/);
  });

  it("numSamples: 0 omits the Sample outputs section entirely", async () => {
    const file = plugin.app.vault.getAbstractFileByPath(
      "workflows/npc-generator.md",
    );
    const md = await buildWorkflowMarkdown(
      plugin as never,
      file as MockTFile as never,
      { numSamples: 0 },
    );
    expect(md).not.toMatch(/## Sample outputs/);
    expect(md).not.toMatch(/### Sample \d+/);
    // Steps + Template still present
    expect(md).toMatch(/## Steps/);
    expect(md).toMatch(/## Template/);
  });

  it("writes the markdown export to the configured folder", async () => {
    const file = plugin.app.vault.getAbstractFileByPath(
      "workflows/npc-generator.md",
    );
    await exportWorkflowAsMarkdown(
      plugin as never,
      file as MockTFile as never,
      { numSamples: 2 },
    );
    const out = await fs.readFile(
      path.join(tmpDir, "exports/npc-generator.md"),
      "utf8",
    );
    expect(out).toMatch(/# npc-generator/);
    expect(out).toMatch(/### Sample 1/);
    expect(out).toMatch(/### Sample 2/);
  });
});
