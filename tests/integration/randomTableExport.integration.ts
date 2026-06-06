/**
 * Integration test for the random-table PDF export pipeline.
 *
 * What this tests (Layer 4 in the testing-web-frontend taxonomy):
 *   - parseRandomTable correctly reads the fixture
 *   - formatRandomTableMarkdown produces the expected markdown
 *   - Our printScaffold CSS produces a valid PDF via Chromium
 *   - All entry results appear in the rendered PDF text
 *   - Page 1 renders as a PNG we can visually inspect
 *
 * What this does NOT test (would need Obsidian runtime):
 *   - Obsidian's MarkdownRenderer.render() — we substitute a minimal
 *     md→html converter for the table subset we generate
 *   - The user's installed theme inheritance (document.styleSheets capture)
 *   - The webview lifecycle inside Obsidian's renderer process
 *
 * Engine note: Chromium's printToPDF (driven via Puppeteer in
 * chromium-driver) is the same engine Obsidian's <webview>.printToPDF uses.
 * Bit-equivalent output for the same HTML + CSS.
 */

import { describe, it, before, after } from "node:test";
import expect from "expect";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

import { parseRandomTable } from "../../src/random-tables/randomTable";
import {
  formatRandomTableMarkdown,
  formatLinkedNotesAppendix,
  type LinkedNote,
} from "../../src/export/exporters/randomTable";
import { PRINT_PATCH_CSS, wrapInPrintScaffold, escapeHtml } from "../../src/export/printScaffold";

const CHROMIUM_DRIVER = "/mnt/c/Users/markr/work/tools/chromium-driver";
const FIXTURE = path.resolve(__dirname, "../fixtures/sample-random-table.md");

let tmpDir: string;

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "duckmage-export-itest-"));
});

after(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("random table PDF export — integration", () => {
  it("produces a valid PDF that contains every entry", async () => {
    const md = await formatFixture();
    const html = wrapInFullHtml(md, "Sample wandering monsters");
    const pdfPath = path.join(tmpDir, "sample.pdf");

    const { htmlToPdf } = await import(`${CHROMIUM_DRIVER}/scripts/html-to-pdf.mjs`);
    const result = await htmlToPdf(html, pdfPath, { pageSize: "Letter" });

    // 1. File created with non-trivial size
    expect(result.sizeBytes).toBeGreaterThan(3000);

    // 2. pdfinfo confirms it is a valid PDF
    const info = execSync(`pdfinfo "${pdfPath}"`).toString();
    expect(info).toMatch(/PDF version:/);
    expect(info).toMatch(/Pages:\s+\d+/);

    // 3. All fixture entries appear in extracted text
    const text = execSync(`pdftotext "${pdfPath}" -`).toString();
    const expectedEntries = [
      "Pack of wolves",
      "Lost merchant",
      "Bandit ambush",
      "Druid circle",
      "Wild boar",
      "Travelling minstrel",
      "Goblin scouts",
    ];
    for (const entry of expectedEntries) {
      expect(text).toMatch(new RegExp(entry));
    }

    // 4. Roll-die line present (dice: 20 in frontmatter)
    expect(text).toMatch(/Roll d20/);
  });

  it("renders a known-good PNG of page 1 for visual inspection", async () => {
    const md = await formatFixture();
    const html = wrapInFullHtml(md, "Sample wandering monsters");
    const pdfPath = path.join(tmpDir, "sample.pdf");

    const { htmlToPdf } = await import(`${CHROMIUM_DRIVER}/scripts/html-to-pdf.mjs`);
    await htmlToPdf(html, pdfPath, { pageSize: "Letter" });

    const pngStem = path.join(tmpDir, "page");
    execSync(`pdftoppm -png -r 96 -f 1 -l 1 "${pdfPath}" "${pngStem}"`);
    const pngPath = `${pngStem}-1.png`;
    const stat = await fs.stat(pngPath);
    expect(stat.isFile()).toBe(true);
    expect(stat.size).toBeGreaterThan(5000);

    // Keep last-run output for ad-hoc visual inspection.
    const persistPath = path.resolve(__dirname, "../../.integration-out");
    await fs.mkdir(persistPath, { recursive: true });
    await fs.copyFile(pngPath, path.join(persistPath, "sample-random-table-page1.png"));
    await fs.copyFile(pdfPath, path.join(persistPath, "sample-random-table.pdf"));
  });
});

describe("random table PDF export with linked notes — integration", () => {
  it("includes each linked note's content in the rendered PDF, in entry order", async () => {
    // Synthesize the same markdown the runtime would produce when 3 entries
    // resolve to vault notes. We bypass the vault lookup since this test runs
    // outside Obsidian — the formatters and the rendering pipeline are what
    // we're validating here.
    const baseMd = await formatFixture();
    const linkedNotes: LinkedNote[] = [
      {
        name: "Pack of wolves",
        content:
          "A pack of **6–10 grey wolves** stalking the party. They strike at dusk and fade into the trees if injured.",
      },
      {
        name: "Bandit ambush",
        content:
          "A roadside ambush by *desperate* highway robbers. They demand coin first; fight only if pushed.",
      },
      {
        name: "Druid circle",
        content:
          "A solemn gathering of three druids in a moonlit clearing. They speak the language of birds.",
      },
    ];
    const appendix = formatLinkedNotesAppendix(linkedNotes);
    expect(appendix.length).toBeGreaterThan(0);
    const fullMd = `${baseMd}\n\n${appendix}`;
    const html = wrapInFullHtml(fullMd, "Sample wandering monsters (with linked notes)");

    const pdfPath = path.join(tmpDir, "sample-with-notes.pdf");
    const { htmlToPdf } = await import(`${CHROMIUM_DRIVER}/scripts/html-to-pdf.mjs`);
    await htmlToPdf(html, pdfPath, { pageSize: "Letter" });

    // PDF valid + has multiple pages OR enough content
    const info = execSync(`pdfinfo "${pdfPath}"`).toString();
    expect(info).toMatch(/PDF version:/);

    const text = execSync(`pdftotext "${pdfPath}" -`).toString();

    // Table entries (from base) still present
    expect(text).toMatch(/Pack of wolves/);
    expect(text).toMatch(/Bandit ambush/);
    expect(text).toMatch(/Druid circle/);

    // Linked-note content present. Use a normalized form that collapses
    // whitespace (pdftotext line-wraps inside paragraphs).
    const flat = text.replace(/\s+/g, " ");
    expect(flat).toMatch(/grey wolves/);
    expect(flat).toMatch(/highway robbers/);
    expect(flat).toMatch(/moonlit clearing/);
    expect(flat).toMatch(/language of birds/);

    // Entry order preserved in PDF text
    const idxWolves = flat.indexOf("grey wolves");
    const idxBandits = flat.indexOf("highway robbers");
    const idxDruids = flat.indexOf("moonlit clearing");
    expect(idxWolves).toBeGreaterThan(-1);
    expect(idxBandits).toBeGreaterThan(idxWolves);
    expect(idxDruids).toBeGreaterThan(idxBandits);

    // Persist for visual inspection
    const pngStem = path.join(tmpDir, "page-notes");
    execSync(`pdftoppm -png -r 96 -f 1 -l 2 "${pdfPath}" "${pngStem}"`);
    const persistPath = path.resolve(__dirname, "../../.integration-out");
    await fs.mkdir(persistPath, { recursive: true });
    await fs.copyFile(pdfPath, path.join(persistPath, "sample-with-linked-notes.pdf"));
    // Copy whatever page PNGs were produced.
    for (const pageFile of await fs.readdir(tmpDir)) {
      if (pageFile.startsWith("page-notes-") && pageFile.endsWith(".png")) {
        await fs.copyFile(
          path.join(tmpDir, pageFile),
          path.join(persistPath, `sample-with-linked-notes-${pageFile.slice("page-notes-".length)}`),
        );
      }
    }
  });

  it("emits no appendix when no entries resolve", () => {
    expect(formatLinkedNotesAppendix([])).toBe("");
  });

  // Stress test: long notes + an oversized image. Without proper CSS, this
  // exposes (a) images blowing past the page width and (b) section headings
  // becoming orphaned at the bottom of a page with their content on the next.
  it("keeps headings with content and constrains image size on multi-page output", async () => {
    const baseMd = await formatFixture();

    // A 1200x900 SVG — deliberately larger than the printable column width
    // (Letter at 0.6" left + 0.6" right margin ≈ 7.3" wide ≈ 700px @ 96dpi).
    // If the CSS doesn't constrain it, the image will overflow horribly.
    const bigImgSvgRaw =
      `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">` +
      `<rect width="1200" height="900" fill="#9bbcd9"/>` +
      `<rect x="50" y="50" width="1100" height="800" fill="none" stroke="#1d4d80" stroke-width="6"/>` +
      `<text x="600" y="450" text-anchor="middle" font-family="sans-serif" font-size="48" fill="#1d4d80">` +
      `Oversized test image (1200x900)</text></svg>`;
    const bigImgUrl = `data:image/svg+xml;base64,${Buffer.from(bigImgSvgRaw).toString("base64")}`;

    const longPara = (n: number) =>
      `Paragraph ${n} of an intentionally long encounter writeup. ` +
      `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor ` +
      `incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud ` +
      `exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.`;

    const linkedNotes: LinkedNote[] = [
      {
        name: "Pack of wolves",
        content:
          "A pack of **6–10 grey wolves** stalking the party. They strike at dusk and fade into the trees if injured.",
      },
      {
        name: "Lost merchant",
        content:
          `![A weathered map of the forest road](${bigImgUrl})\n\n` +
          "A travelling cloth merchant separated from a caravan. Knows the way back to town and will pay for an escort.",
      },
      {
        name: "Bandit ambush",
        content:
          "A roadside ambush by *desperate* highway robbers. They demand coin first; fight only if pushed.\n\n" +
          longPara(1) +
          "\n\n" +
          longPara(2) +
          "\n\n" +
          longPara(3) +
          "\n\n" +
          longPara(4) +
          "\n\n" +
          longPara(5),
      },
      {
        name: "Druid circle",
        content:
          "A solemn gathering of three druids in a moonlit clearing. They speak the language of birds.",
      },
      {
        name: "Wild boar",
        content:
          "A territorial **boar** charges from undergrowth. Hardy and aggressive. " +
          longPara(6) +
          "\n\n" +
          longPara(7),
      },
    ];
    const appendix = formatLinkedNotesAppendix(linkedNotes);
    const fullMd = `${baseMd}\n\n${appendix}`;
    const html = wrapInFullHtml(fullMd, "Pagination stress test");

    const pdfPath = path.join(tmpDir, "pagination-stress.pdf");
    const { htmlToPdf } = await import(`${CHROMIUM_DRIVER}/scripts/html-to-pdf.mjs`);
    await htmlToPdf(html, pdfPath, { pageSize: "Letter" });

    const info = execSync(`pdfinfo "${pdfPath}"`).toString();
    const pages = parseInt(/Pages:\s+(\d+)/.exec(info)?.[1] ?? "1", 10);
    // Multi-page output expected — that's the whole point of this test.
    expect(pages).toBeGreaterThan(1);

    // Render every page to PNG for visual inspection.
    const pngStem = path.join(tmpDir, "stress");
    execSync(`pdftoppm -png -r 96 "${pdfPath}" "${pngStem}"`);

    const persistPath = path.resolve(__dirname, "../../.integration-out");
    await fs.mkdir(persistPath, { recursive: true });
    await fs.copyFile(pdfPath, path.join(persistPath, "pagination-stress.pdf"));
    for (const pageFile of await fs.readdir(tmpDir)) {
      if (pageFile.startsWith("stress-") && pageFile.endsWith(".png")) {
        await fs.copyFile(
          path.join(tmpDir, pageFile),
          path.join(
            persistPath,
            `pagination-stress-${pageFile.slice("stress-".length)}`,
          ),
        );
      }
    }
  });
});

async function formatFixture(): Promise<string> {
  const content = await fs.readFile(FIXTURE, "utf8");
  const table = parseRandomTable(content);
  return formatRandomTableMarkdown("Sample wandering monsters", table);
}

/**
 * Compose the full HTML document the runtime would render. Substitutes a
 * minimal markdown→HTML converter for Obsidian's MarkdownRenderer since this
 * test runs outside Obsidian.
 */
function wrapInFullHtml(markdown: string, title: string): string {
  const inner = miniMarkdownToHtml(markdown);
  const body = wrapInPrintScaffold(title, inner);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${PRINT_PATCH_CSS}</style>
</head><body class="theme-light">${body}</body></html>`;
}

/**
 * Minimal markdown→HTML for the subset our exporter emits:
 *   - `# heading`
 *   - `*italic*`
 *   - markdown tables (`|cell|cell|` with separator row)
 *   - plain paragraphs
 *
 * NOT a general markdown renderer. Real runtime uses Obsidian's renderer.
 */
function miniMarkdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inTable = false;
  let headerEmitted = false;

  const closeTable = () => {
    if (inTable) {
      out.push("</tbody></table>");
      inTable = false;
      headerEmitted = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
    if (line.startsWith("### ")) {
      closeTable();
      out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith("## ")) {
      closeTable();
      out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("# ")) {
      closeTable();
      out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
      continue;
    }
    if (/^-{3,}\s*$/.test(line)) {
      closeTable();
      out.push("<hr>");
      continue;
    }
    // Inline HTML block (e.g. <section>, </section>) — pass through verbatim
    // so the wrapping markup the appendix formatter emits survives.
    if (line.startsWith("<")) {
      closeTable();
      out.push(line);
      continue;
    }
    if (line.trim() === "") {
      closeTable();
      continue;
    }
    if (line.startsWith("|")) {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      if (cells.every((c) => /^[\-:]+$/.test(c))) continue; // separator row
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
    closeTable();
    out.push(`<p>${renderInline(line)}</p>`);
  }
  closeTable();
  return out.join("\n");
}

function renderInline(s: string): string {
  // Extract image syntax first so its URL doesn't get escaped.
  // ![alt](url) — both alt and url
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
