/**
 * Integration test for the workflow PDF export (Phase 1.6).
 *
 * Synthesizes the markdown that `buildWorkflowMarkdown` would produce for a
 * small workflow with 3 sample outputs, runs it through chromium-driver, and
 * asserts the rendered PDF contains the steps table, template, every sample
 * heading, the per-sample rolls breakdown, and the filled-in template text.
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
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "duckmage-workflow-itest-"));
});

after(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("workflow PDF export — integration", () => {
  it("renders the steps table, template, and N sample outputs with breakdowns", async () => {
    const md = [
      `# NPC Generator`,
      ``,
      `Roll a random encounter NPC with a name, occupation, and demeanor.`,
      ``,
      `## Steps`,
      ``,
      `| # | Table / Formula | Rolls | Label |`,
      `| --- | --- | --- | --- |`,
      `| 1 | names/first | 1 | name |`,
      `| 2 | occupations | 1 | job |`,
      `| 3 | demeanors | 1 | mood |`,
      `| 4 | 2d6+3 | 1 | hp |`,
      ``,
      `## Template`,
      ``,
      "```",
      "$name the $job, a $mood traveller (HP $hp).",
      "```",
      ``,
      `## Sample outputs`,
      ``,
      `<section class="duckmage-workflow-sample">`,
      ``,
      `### Sample 1`,
      ``,
      `| Step | Label | Roll | Value |`,
      `| --- | --- | --- | --- |`,
      `| 1 | name | — | Bromund |`,
      `| 2 | job | — | tinsmith |`,
      `| 3 | mood | — | cheerful |`,
      `| 4 | hp | — | (4+5)+3=12 |`,
      ``,
      `Bromund the tinsmith, a cheerful traveller (HP (4+5)+3=12).`,
      ``,
      `</section>`,
      ``,
      `<section class="duckmage-workflow-sample">`,
      ``,
      `### Sample 2`,
      ``,
      `| Step | Label | Roll | Value |`,
      `| --- | --- | --- | --- |`,
      `| 1 | name | — | Lirel |`,
      `| 2 | job | — | rope-maker |`,
      `| 3 | mood | — | wary |`,
      `| 4 | hp | — | (3+2)+3=8 |`,
      ``,
      `Lirel the rope-maker, a wary traveller (HP (3+2)+3=8).`,
      ``,
      `</section>`,
      ``,
      `<section class="duckmage-workflow-sample">`,
      ``,
      `### Sample 3`,
      ``,
      `| Step | Label | Roll | Value |`,
      `| --- | --- | --- | --- |`,
      `| 1 | name | — | Vargax |`,
      `| 2 | job | — | charcoal-burner |`,
      `| 3 | mood | — | drunk |`,
      `| 4 | hp | — | (6+6)+3=15 |`,
      ``,
      `Vargax the charcoal-burner, a drunk traveller (HP (6+6)+3=15).`,
      ``,
      `</section>`,
    ].join("\n");

    const html = wrapInFullHtml(md, "NPC Generator");
    const pdfPath = path.join(tmpDir, "workflow.pdf");
    const { htmlToPdf } = await import(`${CHROMIUM_DRIVER}/scripts/html-to-pdf.mjs`);
    await htmlToPdf(html, pdfPath, { pageSize: "Letter" });

    const info = execSync(`pdfinfo "${pdfPath}"`).toString();
    expect(info).toMatch(/PDF version:/);

    const text = execSync(`pdftotext "${pdfPath}" -`).toString();
    const flat = text.replace(/\s+/g, " ");

    // Top-level structure
    expect(text).toMatch(/NPC Generator/);
    expect(text).toMatch(/Roll a random encounter NPC/);
    expect(text).toMatch(/Steps/);
    expect(text).toMatch(/Template/);
    expect(text).toMatch(/Sample outputs/);

    // Steps table fragments
    expect(flat).toMatch(/names\/first/);
    expect(flat).toMatch(/2d6\+3/);

    // Every sample heading
    expect(text).toMatch(/Sample 1/);
    expect(text).toMatch(/Sample 2/);
    expect(text).toMatch(/Sample 3/);

    // Per-sample rolled values + filled template
    expect(flat).toMatch(/Bromund the tinsmith/);
    expect(flat).toMatch(/Lirel the rope-maker/);
    expect(flat).toMatch(/Vargax the charcoal-burner/);
    expect(flat).toMatch(/cheerful traveller/);

    // Persist for visual inspection
    const pngStem = path.join(tmpDir, "page");
    execSync(`pdftoppm -png -r 96 "${pdfPath}" "${pngStem}"`);
    const persistPath = path.resolve(__dirname, "../../.integration-out");
    await fs.mkdir(persistPath, { recursive: true });
    await fs.copyFile(pdfPath, path.join(persistPath, "workflow.pdf"));
    for (const f of await fs.readdir(tmpDir)) {
      if (f.startsWith("page-") && f.endsWith(".png")) {
        await fs.copyFile(
          path.join(tmpDir, f),
          path.join(persistPath, `workflow-${f.slice("page-".length)}`),
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
  let inFence = false;
  const fenceBuf: string[] = [];
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
    if (line.startsWith("```")) {
      closeAll();
      if (inFence) {
        out.push(`<pre><code>${escapeHtml(fenceBuf.join("\n"))}</code></pre>`);
        fenceBuf.length = 0;
        inFence = false;
      } else {
        inFence = true;
      }
      continue;
    }
    if (inFence) {
      fenceBuf.push(line);
      continue;
    }
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
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\\\|/g, "|");
}
