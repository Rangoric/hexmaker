#!/usr/bin/env node
/** Capture the half-baked frame between font-size change and SVG rebuild
 *  in both the buggy order (SVG torn down last) and the fixed order
 *  (SVG torn down first). The 300ms setTimeout in the sandbox is the
 *  paint window — snapshot DURING that window, while the SVG is in its
 *  stale-vs-absent state, to see which one shows misplaced labels.  */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs/promises";
import { withBrowser } from "/mnt/c/Users/markr/work/tools/chromium-driver/lib/browser.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const sandbox = path.join(here, "coord-slip-sandbox.html");
const outDir = path.join(here, "out");
await fs.mkdir(outDir, { recursive: true });

await withBrowser(
  async ({ page }) => {
    await page.goto(pathToFileURL(sandbox).href, { waitUntil: "networkidle0" });
    const snap = async (name) => {
      const el = await page.$(".viewport");
      await el.screenshot({ path: path.join(outDir, `${name}.png`) });
      console.log(path.join(outDir, `${name}.png`));
    };

    await snap("slip-1-baseline");

    await page.click("#reset");
    await new Promise((r) => setTimeout(r, 100));
    await page.click("#buggy-bake");
    // Capture mid-transition — during the 300ms SVG-rebuild delay
    await new Promise((r) => setTimeout(r, 100));
    await snap("slip-2-buggy-mid");
    await new Promise((r) => setTimeout(r, 400));
    await snap("slip-3-buggy-final");

    await page.click("#reset");
    await new Promise((r) => setTimeout(r, 100));
    await page.click("#fixed-bake");
    await new Promise((r) => setTimeout(r, 100));
    await snap("slip-4-fixed-mid");
    await new Promise((r) => setTimeout(r, 400));
    await snap("slip-5-fixed-final");
  },
  { viewport: { width: 900, height: 600 } },
);
