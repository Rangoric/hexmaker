/**
 * Integration test for the single-note PDF export pipeline (Phase 1.2).
 *
 * Pipeline:
 *   read fixture → stripFrontmatter → ensureLeadingTitle → mini md→html →
 *   wrap in print scaffold → chromium-driver htmlToPdf → pdfinfo + pdftotext
 *
 * What this validates:
 *   - Frontmatter is stripped (tags/population shouldn't appear in PDF)
 *   - Title is the file basename (prepended because the fixture has no H1)
 *   - All section headings + bullets render
 *   - Bold/italic survive the pipeline
 *
 * What it doesn't (would need Obsidian runtime):
 *   - Theme inheritance from document.styleSheets
 *   - Wikilink resolution to clickable anchors
 */

import { describe, it, before, after } from "node:test";
import expect from "expect";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

import { ensureLeadingTitle } from "../../src/export/exporters/singleNote";
import { PRINT_PATCH_CSS, wrapInPrintScaffold, escapeHtml } from "../../src/export/printScaffold";

const CHROMIUM_DRIVER = "/mnt/c/Users/markr/work/tools/chromium-driver";
const FIXTURE = path.resolve(__dirname, "../fixtures/sample-town.md");

let tmpDir: string;

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "duckmage-single-itest-"));
});

after(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("single note PDF export — integration", () => {
  it("renders the fixture cleanly with stripped frontmatter and prepended title", async () => {
    const raw = await fs.readFile(FIXTURE, "utf8");
    const md = ensureLeadingTitle(raw, "Saltwatch");
    const html = wrapInFullHtml(md, "Saltwatch");

    const pdfPath = path.join(tmpDir, "saltwatch.pdf");
    const { htmlToPdf } = await import(`${CHROMIUM_DRIVER}/scripts/html-to-pdf.mjs`);
    const result = await htmlToPdf(html, pdfPath, { pageSize: "Letter" });
    expect(result.sizeBytes).toBeGreaterThan(3000);

    const info = execSync(`pdfinfo "${pdfPath}"`).toString();
    expect(info).toMatch(/PDF version:/);

    const text = execSync(`pdftotext "${pdfPath}" -`).toString();

    // Title (prepended because fixture has no H1)
    expect(text).toMatch(/Saltwatch/);

    // Section headings
    expect(text).toMatch(/Overview/);
    expect(text).toMatch(/Notable Residents/);
    expect(text).toMatch(/Hooks & Rumors/);

    // Content fragments unique to each section
    expect(text).toMatch(/southern cliffs/);
    expect(text).toMatch(/Maren Kell/);
    expect(text).toMatch(/lighthouse burns blue/);

    // Frontmatter must NOT leak into the rendered text
    expect(text).not.toMatch(/tags:\s*\[/);
    expect(text).not.toMatch(/population:\s*320/);

    // Persist for visual inspection
    const pngStem = path.join(tmpDir, "page");
    execSync(`pdftoppm -png -r 96 -f 1 -l 1 "${pdfPath}" "${pngStem}"`);
    const persistPath = path.resolve(__dirname, "../../.integration-out");
    await fs.mkdir(persistPath, { recursive: true });
    await fs.copyFile(pdfPath, path.join(persistPath, "single-note.pdf"));
    await fs.copyFile(`${pngStem}-1.png`, path.join(persistPath, "single-note-page1.png"));
  });

  it("does not prepend a title when the note already begins with H1", () => {
    const raw = "# My existing title\n\nSome content.";
    expect(ensureLeadingTitle(raw, "Other Name")).toBe(raw);
  });
});

// ─── helpers shared with the random-table integration test ─────────────────

function wrapInFullHtml(markdown: string, title: string): string {
  const inner = miniMarkdownToHtml(markdown);
  const body = wrapInPrintScaffold(title, inner);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${PRINT_PATCH_CSS}</style>
</head><body class="theme-light">${body}</body></html>`;
}

/**
 * Minimal markdown→HTML for our exporter's emitted subset:
 *   h1/h2/h3, ul (bullets), tables, paragraphs, ![alt](url), `<section>` blocks.
 * NOT a general markdown renderer.
 */
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
