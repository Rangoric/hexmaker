/**
 * Pure helpers for assembling a print-ready HTML document.
 *
 * Lives separately from htmlRenderer.ts so the integration test (which
 * cannot import `obsidian`) can pull the same scaffold + CSS the runtime
 * uses. Keep both in sync by importing from here.
 */

/**
 * Wrap rendered inner HTML in the standard `.print` scaffold.
 * The outer `.print` div scopes the print-patch CSS without leaking globally.
 *
 * Does NOT inject an h1 title — the source markdown is expected to carry its
 * own `# Title` heading, which the markdown renderer turns into an h1. Adding
 * a second h1 here would double-render the title.
 *
 * @param _title  Reserved for future use (PDF metadata / scaffold-only paths).
 *                Currently unused in the body but kept in the signature so
 *                callers continue to pass it; we may surface it as a header
 *                or fallback when there's no leading h1 in the markdown.
 */
export function wrapInPrintScaffold(_title: string, innerHtml: string): string {
  return `<div class="print"><div class="markdown-preview-view markdown-rendered">${innerHtml}</div></div>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Print-specific CSS patches. Forces white background, sensible margins, sane
 * page-break behaviour around tables, and a printable title style.
 *
 * Applied on TOP of whatever theme CSS was captured at runtime — its job is
 * to override any dark/unreadable theme rules and add print-specific
 * formatting (page breaks, table layout).
 */
export const PRINT_PATCH_CSS = `
  /* duckmage export print patches */
  html, body {
    background: #ffffff !important;
    color: #111111 !important;
    margin: 0;
    padding: 0;
  }
  body.theme-light {
    --background-primary: #ffffff;
    --text-normal: #111111;
  }
  .print {
    padding: 0;
    background: #ffffff;
  }
  .print .markdown-preview-view,
  .print .markdown-rendered {
    background: #ffffff !important;
    color: #111111 !important;
    padding: 0.5in 0.6in;
    max-width: none;
    height: auto !important;
  }
  /* Title style — applies to the markdown's leading h1 inside the print scaffold */
  .print h1:first-child {
    font-size: 1.7em;
    margin: 0 0 0.6em 0;
    padding-bottom: 0.3em;
    border-bottom: 2px solid #333;
  }

  /* Constrain images so a huge source asset doesn't blow out a page.
     max-height of 4in (~ 40% of a Letter page) keeps the heading + image +
     caption able to share a page comfortably, while still showing the image
     at a useful size for a printed game aid. Small images render at their
     natural size (width: auto, no min sizing). */
  .print img {
    max-width: 100%;
    max-height: 4in;
    width: auto;
    height: auto;
    object-fit: contain;
  }

  /* Map-PDF specific overrides: the cover-page map fills the page; the
     section-page map sits at the top in landscape mode and gets ~ 40% of
     the available height. */
  .print img.duckmage-pdf-fullmap {
    display: block;
    width: 100%;
    height: auto;
    max-height: 6.5in;
    margin: 0 auto;
    object-fit: contain;
  }
  .print img.duckmage-pdf-sectionmap {
    display: block;
    width: 100%;
    height: auto;
    max-height: 3.6in;
    margin: 0 auto 0.6em auto;
    object-fit: contain;
  }

  /* Explicit page-break marker used by the map PDF exporter. The empty div
     forces the renderer to start a new page even when the previous content
     leaves room. */
  .print .duckmage-pdf-pagebreak {
    break-before: page;
    page-break-before: always;
    height: 0;
    margin: 0;
    padding: 0;
  }

  /* Workflow sample blocks. Each sampled output gets its own visually
     separated block. */
  .print .duckmage-workflow-sample {
    margin-top: 1.4em;
    padding-top: 1em;
    border-top: 1px solid #ddd;
  }
  .print .duckmage-workflow-sample:first-of-type {
    margin-top: 1em;
    padding-top: 0;
    border-top: none;
  }
  .print .duckmage-workflow-sample > h3 {
    margin-top: 0;
    font-size: 1.1em;
  }
  .print .duckmage-workflow-sample table {
    margin-bottom: 1em;
  }

  /* Single-hex export sections. Each section gets generous breathing room
     and a subtle top border for visual separation. The first section is
     borderless so it doesn't double up with the metadata header above. */
  .print .duckmage-hex-section {
    margin-top: 1.6em;
    padding-top: 1.2em;
    border-top: 1px solid #ddd;
  }
  .print .duckmage-hex-section:first-of-type {
    margin-top: 1.2em;
    padding-top: 0;
    border-top: none;
  }
  .print .duckmage-hex-section > h2 {
    margin-top: 0;
    font-size: 1.25em;
  }
  .print .duckmage-hex-section ul {
    margin: 0.4em 0 0.6em 1.3em;
  }
  .print .duckmage-hex-section p {
    line-height: 1.5;
    margin: 0.4em 0 0.6em 0;
  }

  /* Each linked-note entry in the appendix. Visual separation via top border;
     break control via break-inside: avoid-page (in @media print below). */
  .print .duckmage-export-note {
    border-top: 1px solid #ddd;
    margin-top: 1.4em;
    padding-top: 1em;
  }
  .print .duckmage-export-note-first {
    border-top: 2px solid #999;
    margin-top: 2em;
    padding-top: 1.4em;
  }
  .print .duckmage-export-note > h2 {
    margin-top: 0;
  }

  @media print {
    table { break-inside: auto; width: 100%; border-collapse: collapse; }
    thead { display: table-header-group; }
    tr    { break-inside: avoid; break-after: auto; }
    th, td {
      border: 1px solid #ccc;
      padding: 4px 8px;
      text-align: left;
      vertical-align: top;
    }

    /* Keep headings tied to what follows them. break-after on the heading
       itself + break-before:avoid on the immediate next sibling. */
    h1, h2, h3, h4 { break-after: avoid; }
    h2 + *, h3 + *, h4 + * { break-before: avoid; }

    /* Paragraph orphan/widow control. */
    p { orphans: 3; widows: 3; }

    /* Images shouldn't split across pages. */
    img, figure { break-inside: avoid; }

    /* Tighter table cells for dense map-PDF reference tables (many columns
       on a landscape page) so all hex link sections fit without wrapping
       awkwardly. */
    .print table { font-size: 0.78em; }
    .print th, .print td { padding: 3px 5px; }

    /* Each linked-note entry: keep heading + body together. If the entire
       entry doesn't fit on the remaining page, the browser starts it on a
       new page. Entries larger than one page will split, which is fine —
       this only prevents the avoidable orphan case. */
    .duckmage-export-note { break-inside: avoid-page; }
    /* Same treatment for single-hex export sections. */
    .duckmage-hex-section { break-inside: avoid-page; }
    /* And for workflow sample blocks. */
    .duckmage-workflow-sample { break-inside: avoid-page; }
  }
`;
