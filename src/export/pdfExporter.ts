/**
 * PDF export primitive — wraps Electron's webview `printToPDF()`.
 *
 * Architecture: see knowledgebase/projects/duckmage-plugin/notes/impl/ref-better-export-pdf.md
 * and plan-export-phase1.md.
 *
 * Strategy: create a hidden <webview>, inject the rendered HTML + CSS, force
 * light theme (dark backgrounds print badly), then call printToPDF and clean up.
 */

// Minimal local types — avoids adding `electron` as a dependency just for typings.
interface PrintToPDFOptions {
  landscape?: boolean;
  printBackground?: boolean;
  pageSize?: string | { width: number; height: number };
  margins?: {
    marginType?: "default" | "none" | "printableArea" | "custom";
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  scale?: number;
}

interface WebviewElement extends HTMLElement {
  printToPDF(options: PrintToPDFOptions): Promise<Uint8Array>;
  executeJavaScript(code: string): Promise<unknown>;
}

export interface PdfExportOptions {
  pageSize?: "A4" | "Letter" | "Legal" | "Tabloid" | { width: number; height: number };
  landscape?: boolean;
  /** Margins in inches. Omit for default. */
  margins?: { top: number; bottom: number; left: number; right: number };
  printBackground?: boolean;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  scale?: number;
}

export interface RenderedDoc {
  /** HTML for the page <body> — does NOT include the <body> tag itself. */
  bodyHtml: string;
  /** CSS rules captured from document.styleSheets, joined with newlines. */
  css: string;
  /** Document title. */
  title: string;
}

/**
 * Render a {@link RenderedDoc} to a PDF byte buffer via a hidden webview.
 * Caller is responsible for writing the bytes (e.g. `vault.createBinary`).
 */
export async function exportToPdfBytes(
  doc: RenderedDoc,
  opts: PdfExportOptions = {},
): Promise<Uint8Array> {
  const webview = document.createElement("webview") as WebviewElement;
  webview.setAttribute("src", "app://obsidian.md/help.html");
  webview.setAttribute("nodeintegration", "true");
  webview.addClass("duckmage-export-webview");
  document.body.appendChild(webview);

  try {
    await waitForWebviewLoad(webview);

    const injectScript = buildInjectScript(doc);
    await webview.executeJavaScript(injectScript);

    // Give the webview time to lay out, load fonts, and resolve any deferred work
    // (image decode, late-bound CSS). 300ms is enough for plugin-generated content.
    await sleep(300);

    const printOptions: PrintToPDFOptions = {
      landscape: opts.landscape ?? false,
      printBackground: opts.printBackground ?? true,
      pageSize: opts.pageSize ?? "Letter",
      margins: opts.margins
        ? {
            marginType: "custom",
            top: opts.margins.top,
            bottom: opts.margins.bottom,
            left: opts.margins.left,
            right: opts.margins.right,
          }
        : { marginType: "default" },
      displayHeaderFooter: opts.displayHeaderFooter ?? false,
      headerTemplate: opts.headerTemplate ?? "<span></span>",
      footerTemplate: opts.footerTemplate ?? "<span></span>",
      scale: opts.scale ?? 1,
    };

    const bytes = await webview.printToPDF(printOptions);
    return bytes;
  } finally {
    webview.remove();
  }
}

function waitForWebviewLoad(webview: HTMLElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutMs = 10_000;
    let settled = false;
    const onLoad = () => {
      if (settled) return;
      settled = true;
      webview.removeEventListener("did-finish-load", onLoad);
      resolve();
    };
    webview.addEventListener("did-finish-load", onLoad);
    setTimeout(() => {
      if (settled) return;
      settled = true;
      webview.removeEventListener("did-finish-load", onLoad);
      reject(new Error(`webview did not load within ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

function buildInjectScript(doc: RenderedDoc): string {
  // Encode payloads as URI-component-encoded strings so backticks and ${} in
  // content can't break out of the template literal we're constructing below.
  const bodyEnc = encodeURIComponent(doc.bodyHtml);
  const cssEnc = encodeURIComponent(doc.css);
  const titleEnc = encodeURIComponent(doc.title);

  // Runs inside the webview's renderer process.
  return `
    (() => {
      const body = decodeURIComponent("${bodyEnc}");
      const css = decodeURIComponent("${cssEnc}");
      const title = decodeURIComponent("${titleEnc}");

      // Replace head with a single <style> block from captured CSS plus a
      // minimal print reset. We don't try to preserve the original head — the
      // host page is just a render context.
      const styleEl = document.createElement("style");
      styleEl.textContent = css;
      document.head.innerHTML = "";
      document.head.appendChild(styleEl);

      // Force light theme — dark backgrounds print poorly. This matches the
      // better-export-pdf approach.
      document.body.className = "theme-light";
      document.body.removeAttribute("style");
      document.body.innerHTML = body;

      document.title = title;
    })();
  `;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
