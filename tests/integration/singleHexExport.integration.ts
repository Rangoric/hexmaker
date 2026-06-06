/**
 * Integration test for the single-hex PDF export (Phase 1.5).
 *
 * Builds the markdown that the orchestrator would produce from a sample
 * hex note, runs it through the chromium-driver pipeline, and asserts
 * every section appears in the rendered PDF with appropriate spacing.
 */

import { describe, it, before, after } from "node:test";
import expect from "expect";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

import { PRINT_PATCH_CSS, wrapInPrintScaffold, escapeHtml } from "../../src/export/printScaffold";

const CHROMIUM_DRIVER = "/mnt/c/Users/markr/work/tools/chromium-driver";

let tmpDir: string;

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "duckmage-hex-itest-"));
});

after(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("single-hex PDF export — integration", () => {
  it("renders every section with breathing room and includes GM sections when toggled on", async () => {
    // Hand-built markdown that mirrors what `buildHexMarkdown` produces for a
    // hex note with content in every section AND `includeGmSections: true`.
    const md = [
      `# 5_3`,
      ``,
      `**Coordinate:** 5, 3  `,
      `**Terrain:** forest`,
      ``,
      `<section class="duckmage-hex-section">`,
      ``,
      `## Description`,
      ``,
      `The trees lean north against an old wind. A scoured standing stone juts from the moss.`,
      ``,
      `</section>`,
      ``,
      `<section class="duckmage-hex-section">`,
      ``,
      `## Landmark`,
      ``,
      `Pale stone, lichen-mottled, taller than two riders.`,
      ``,
      `</section>`,
      ``,
      `<section class="duckmage-hex-section">`,
      ``,
      `## Weather`,
      ``,
      `Misty mornings; warm afternoons.`,
      ``,
      `</section>`,
      ``,
      `<section class="duckmage-hex-section">`,
      ``,
      `## Hooks & Rumors`,
      ``,
      `- The standing stone hums at midwinter.`,
      `- A masked rider was seen two evenings ago.`,
      ``,
      `</section>`,
      ``,
      `<section class="duckmage-hex-section">`,
      ``,
      `## Hidden`,
      ``,
      `A weathered cache beneath the standing stone holds three gold ingots.`,
      ``,
      `</section>`,
      ``,
      `<section class="duckmage-hex-section">`,
      ``,
      `## Secret`,
      ``,
      `The standing stone is one of seven binding a sleeping power.`,
      ``,
      `</section>`,
      ``,
      `<section class="duckmage-hex-section">`,
      ``,
      `## Towns`,
      ``,
      `- [[Saltwatch]]`,
      ``,
      `</section>`,
      ``,
      `<section class="duckmage-hex-section">`,
      ``,
      `## Dungeons`,
      ``,
      `- [[The Old Spire]]`,
      `- [[Sunken Crypt]]`,
      ``,
      `</section>`,
      ``,
      `<section class="duckmage-hex-section">`,
      ``,
      `## Features`,
      ``,
      `- [[Standing Stone]]`,
      `- [[Forgotten Path]]`,
      ``,
      `</section>`,
      ``,
      `<section class="duckmage-hex-section">`,
      ``,
      `## Quests`,
      ``,
      `- [[Find the Wanderer]]`,
      ``,
      `</section>`,
      ``,
      `<section class="duckmage-hex-section">`,
      ``,
      `## Factions`,
      ``,
      `- [[The Reach]]`,
      ``,
      `</section>`,
      ``,
      `<section class="duckmage-hex-section">`,
      ``,
      `## Encounters Table`,
      ``,
      `- [[Forest - Encounters]]`,
      ``,
      `</section>`,
    ].join("\n");

    const html = wrapInFullHtml(md, "5_3");
    const pdfPath = path.join(tmpDir, "hex.pdf");
    const { htmlToPdf } = await import(`${CHROMIUM_DRIVER}/scripts/html-to-pdf.mjs`);
    await htmlToPdf(html, pdfPath, { pageSize: "Letter" });

    const info = execSync(`pdfinfo "${pdfPath}"`).toString();
    expect(info).toMatch(/PDF version:/);

    const text = execSync(`pdftotext "${pdfPath}" -`).toString();
    const flat = text.replace(/\s+/g, " ");

    // Title + metadata
    expect(flat).toMatch(/5_3/);
    expect(flat).toMatch(/Coordinate: 5, 3/);
    expect(flat).toMatch(/Terrain: forest/);

    // Every section heading
    expect(flat).toMatch(/Description/);
    expect(flat).toMatch(/Landmark/);
    expect(flat).toMatch(/Weather/);
    expect(flat).toMatch(/Hooks & Rumors/);
    expect(flat).toMatch(/Hidden/);
    expect(flat).toMatch(/Secret/);
    expect(flat).toMatch(/Towns/);
    expect(flat).toMatch(/Dungeons/);
    expect(flat).toMatch(/Features/);
    expect(flat).toMatch(/Quests/);
    expect(flat).toMatch(/Factions/);
    expect(flat).toMatch(/Encounters Table/);

    // Content fragments unique to each section
    expect(flat).toMatch(/scoured standing stone/);
    expect(flat).toMatch(/Pale stone, lichen-mottled/);
    expect(flat).toMatch(/Misty mornings/);
    expect(flat).toMatch(/hums at midwinter/);
    expect(flat).toMatch(/three gold ingots/);
    expect(flat).toMatch(/binding a sleeping power/);
    expect(flat).toMatch(/Saltwatch/);
    expect(flat).toMatch(/The Old Spire/);
    expect(flat).toMatch(/Standing Stone/);
    expect(flat).toMatch(/Find the Wanderer/);
    expect(flat).toMatch(/The Reach/);
    expect(flat).toMatch(/Forest - Encounters/);

    // Persist for visual inspection
    const pngStem = path.join(tmpDir, "page");
    execSync(`pdftoppm -png -r 96 "${pdfPath}" "${pngStem}"`);
    const persistPath = path.resolve(__dirname, "../../.integration-out");
    await fs.mkdir(persistPath, { recursive: true });
    await fs.copyFile(pdfPath, path.join(persistPath, "single-hex.pdf"));
    for (const f of await fs.readdir(tmpDir)) {
      if (f.startsWith("page-") && f.endsWith(".png")) {
        await fs.copyFile(
          path.join(tmpDir, f),
          path.join(persistPath, `single-hex-${f.slice("page-".length)}`),
        );
      }
    }
  });
});

// ─── helpers ───────────────────────────────────────────────────────────────

function wrapInFullHtml(markdown: string, title: string): string {
  const inner = miniMarkdownToHtml(markdown);
  const body = wrapInPrintScaffold(title, inner);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${PRINT_PATCH_CSS}</style>
</head><body class="theme-light">${body}</body></html>`;
}

function miniMarkdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inTable = false;
  let headerEmitted = false;
  let inList = false;
  const closeTable = () => {
    if (inTable) {
      out.push("</tbody></table>");
      inTable = false;
      headerEmitted = false;
    }
  };
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };
  const closeAll = () => {
    closeTable();
    closeList();
  };
  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
    if (line.startsWith("### ")) {
      closeAll();
      out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith("## ")) {
      closeAll();
      out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("# ")) {
      closeAll();
      out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
      continue;
    }
    if (/^-{3,}\s*$/.test(line)) {
      closeAll();
      out.push("<hr>");
      continue;
    }
    if (line.startsWith("<")) {
      closeAll();
      out.push(line);
      continue;
    }
    if (/^[-*] /.test(line)) {
      closeTable();
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${renderInline(line.slice(2))}</li>`);
      continue;
    }
    if (line.trim() === "") {
      closeAll();
      continue;
    }
    if (line.startsWith("|")) {
      closeList();
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.every((c) => /^[\-:]+$/.test(c))) continue;
      if (!inTable) {
        out.push("<table><thead>");
        inTable = true;
      }
      if (!headerEmitted) {
        out.push("<tr>" + cells.map((c) => `<th>${renderInline(c)}</th>`).join("") + "</tr>");
        out.push("</thead><tbody>");
        headerEmitted = true;
      } else {
        out.push("<tr>" + cells.map((c) => `<td>${renderInline(c)}</td>`).join("") + "</tr>");
      }
      continue;
    }
    closeAll();
    out.push(`<p>${renderInline(line)}</p>`);
  }
  closeAll();
  return out.join("\n");
}

function renderInline(s: string): string {
  return s
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target: string, alias: string | undefined) =>
      alias ? alias : target,
    )
    .split(/(<img[^>]*>)/)
    .map((chunk) => {
      if (chunk.startsWith("<img")) return chunk;
      return escapeHtml(chunk)
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>")
        .replace(/\\\|/g, "|");
    })
    .join("");
}
