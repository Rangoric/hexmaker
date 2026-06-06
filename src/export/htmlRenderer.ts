/**
 * HTML rendering primitive — markdown to a {@link RenderedDoc} ready for printToPDF.
 *
 * Uses Obsidian's own `MarkdownRenderer.render()` so the export matches the
 * user's installed theme. CSS is captured by walking `activeDocument.styleSheets`.
 */

import { App, Component, MarkdownRenderer } from "obsidian";
import type { RenderedDoc } from "./pdfExporter";
import { wrapInPrintScaffold, PRINT_PATCH_CSS } from "./printScaffold";

export interface RenderOptions {
  app: App;
  /** Document title (used in <title> and the printed page header). */
  title: string;
  /** Vault-relative source path — passed to Obsidian for wikilink resolution. */
  sourcePath: string;
  /** Markdown content to render. */
  markdown: string;
}

/**
 * Render markdown to a {@link RenderedDoc}. Captures the user's theme CSS so
 * the PDF matches their installed Obsidian theme.
 */
export async function renderMarkdownToHtml(
  opts: RenderOptions,
): Promise<RenderedDoc> {
  const { app, title, sourcePath, markdown } = opts;

  // Off-screen container so MarkdownRenderer.render has a real DOM target.
  const container = activeDocument.body.createDiv({
    cls: "duckmage-export-render-host markdown-preview-view markdown-rendered",
  });
  const component = new Component();
  component.load();

  try {
    await MarkdownRenderer.render(app, markdown, container, sourcePath, component);

    const bodyHtml = wrapInPrintScaffold(title, container.innerHTML);
    const css = captureStyles() + "\n" + PRINT_PATCH_CSS;

    return { bodyHtml, css, title };
  } finally {
    component.unload();
    container.remove();
  }
}

/**
 * Walk `activeDocument.styleSheets` and concatenate all readable CSS rules.
 * Skips Svelte-injected sheets (transient, irrelevant) and silently skips
 * sheets that throw on cssRules access (CORS).
 */
function captureStyles(): string {
  const parts: string[] = [];
  for (const sheet of Array.from(activeDocument.styleSheets)) {
    const node = sheet.ownerNode as Element | null;
    const id = node?.getAttribute("id") ?? "";
    if (id.startsWith("svelte-")) continue;

    try {
      const rules = sheet.cssRules;
      if (!rules) continue;
      for (const rule of Array.from(rules)) {
        parts.push(rule.cssText);
      }
    } catch {
      // CORS or other access failure — skip this sheet.
    }
  }
  return parts.join("\n");
}

