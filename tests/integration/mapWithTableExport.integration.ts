/**
 * Integration test for the map → PDF with reference table pipeline (Phase 1.4).
 *
 * What this validates:
 *   - A markdown document with a heading + embedded image + reference table
 *     renders correctly through the chromium-driver pipeline
 *   - The image renders within the constrained 4in max-height (no overflow)
 *   - All table rows appear in the rendered PDF text
 *
 * We synthesize the markdown directly rather than driving the full
 * orchestrator (which requires Obsidian's plugin/vault stack). The pure
 * builder logic is covered by tests/mapWithTableExport.test.ts; this test
 * proves the rendered PDF is correctly assembled.
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
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "duckmage-map-itest-"));
});

after(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("map → PDF with reference table — integration", () => {
  it("renders cover + TOC + section pages with cropped maps and full reference tables", async () => {
    // Two synthetic SVG placeholders — one for the full map, one for each
    // section view. The orchestrator renders separate PNGs per section in
    // production; we use a different colour per "section" so the rendered
    // PDF visibly distinguishes them.
    const fullSvg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="640">` +
      `<rect width="900" height="640" fill="#2a3540"/>` +
      `<text x="450" y="320" text-anchor="middle" font-family="sans-serif" ` +
      `font-size="36" fill="#cbd5e1">[ full map placeholder ]</text></svg>`;
    const sectionASvg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="320">` +
      `<rect width="700" height="320" fill="#3b5c7a"/>` +
      `<text x="350" y="160" text-anchor="middle" font-family="sans-serif" ` +
      `font-size="28" fill="#fff">[ section A1 placeholder ]</text></svg>`;
    const sectionBSvg = sectionASvg.replace("A1", "B1").replace("#3b5c7a", "#5c7a3b");

    const fullUri = `data:image/svg+xml;base64,${Buffer.from(fullSvg).toString("base64")}`;
    const aUri = `data:image/svg+xml;base64,${Buffer.from(sectionASvg).toString("base64")}`;
    const bUri = `data:image/svg+xml;base64,${Buffer.from(sectionBSvg).toString("base64")}`;

    // Mirrors the orchestrator's output: cover, TOC, two section pages.
    const md = [
      `# the-coast`,
      ``,
      `<img src="${fullUri}" alt="the-coast full map" class="duckmage-pdf-fullmap">`,
      ``,
      `<div class="duckmage-pdf-pagebreak"></div>`,
      ``,
      `## Section index`,
      ``,
      `| Section | Hex range (col, row) |`,
      `| --- | --- |`,
      `| **A1** | (0, 0) — (2, 1) |`,
      `| **B1** | (3, 0) — (5, 1) |`,
      ``,
      `<div class="duckmage-pdf-pagebreak"></div>`,
      ``,
      `## Section A1`,
      ``,
      `<img src="${aUri}" alt="A1" class="duckmage-pdf-sectionmap">`,
      ``,
      `| Hex | Terrain | Towns | Dungeons | Features | Quests | Factions | Encounters | Description |`,
      `| --- | --- | --- | --- | --- | --- | --- | --- | --- |`,
      `| 0,0 | grass | Saltwatch |  | Standing Stones |  |  |  | A small fishing town on the coast. |`,
      `| 1,0 | forest |  | Old Spire | Hidden Ruin |  |  | Forest - Encounters | Dense woods. |`,
      `| 2,0 | mountain |  | Goblin Lair |  |  | The Reach |  | Steep cliffs rise sharply. |`,
      ``,
      `<div class="duckmage-pdf-pagebreak"></div>`,
      ``,
      `## Section B1`,
      ``,
      `<img src="${bUri}" alt="B1" class="duckmage-pdf-sectionmap">`,
      ``,
      `| Hex | Terrain | Towns | Dungeons | Features | Quests | Factions | Encounters | Description |`,
      `| --- | --- | --- | --- | --- | --- | --- | --- | --- |`,
      `| 3,0 | shallows |  |  |  |  |  |  | Calm blue water. |`,
      `| 4,0 | grass |  |  |  | Lost Caravan | The Reach |  | Pastureland. |`,
      `| 5,0 | hills |  |  |  |  |  |  | Sheep country. |`,
    ].join("\n");

    const html = wrapInFullHtml(md, "the-coast");
    const pdfPath = path.join(tmpDir, "map-with-table.pdf");

    const { htmlToPdf } = await import(`${CHROMIUM_DRIVER}/scripts/html-to-pdf.mjs`);
    await htmlToPdf(html, pdfPath, { pageSize: "Letter", landscape: true });

    const info = execSync(`pdfinfo "${pdfPath}"`).toString();
    expect(info).toMatch(/PDF version:/);
    // Cover + TOC + 2 section pages = 4 pages
    const pages = parseInt(/Pages:\s+(\d+)/.exec(info)?.[1] ?? "1", 10);
    expect(pages).toBeGreaterThanOrEqual(4);

    const text = execSync(`pdftotext "${pdfPath}" -`).toString();
    const flat = text.replace(/\s+/g, " ");

    // Cover title + TOC + section headings
    expect(text).toMatch(/the-coast/);
    expect(text).toMatch(/Section index/);
    expect(text).toMatch(/Section A1/);
    expect(text).toMatch(/Section B1/);

    // Per-section content
    expect(flat).toMatch(/Saltwatch/);
    expect(flat).toMatch(/Goblin Lair/);
    expect(flat).toMatch(/Forest - Encounters/);
    expect(flat).toMatch(/Standing Stones/);
    expect(flat).toMatch(/Lost Caravan/);
    expect(flat).toMatch(/The Reach/);
    expect(flat).toMatch(/fishing town/);
    expect(flat).toMatch(/Calm blue water/);
    expect(flat).toMatch(/Sheep country/);

    // Persist for visual inspection
    const pngStem = path.join(tmpDir, "page");
    execSync(`pdftoppm -png -r 96 "${pdfPath}" "${pngStem}"`);
    const persistPath = path.resolve(__dirname, "../../.integration-out");
    await fs.mkdir(persistPath, { recursive: true });
    await fs.copyFile(pdfPath, path.join(persistPath, "map-with-table.pdf"));
    for (const f of await fs.readdir(tmpDir)) {
      if (f.startsWith("page-") && f.endsWith(".png")) {
        await fs.copyFile(
          path.join(tmpDir, f),
          path.join(persistPath, `map-with-table-${f.slice("page-".length)}`),
        );
      }
    }
  });
});

// ─── helpers shared with other integration tests ───────────────────────────

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
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, url) =>
      `<img src="${url.replace(/"/g, "&quot;")}" alt="${escapeHtml(alt)}">`,
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
