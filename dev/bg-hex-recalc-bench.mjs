#!/usr/bin/env node
/** Headless benchmark: isolates the style-recalc cost of the current
 *  `:not([style*="background-color"])` attribute-substring selector vs a
 *  class-based `:not(.has-terrain)` selector, at the real chult map's hex
 *  count (63×61). A :hover state change over the grid forces exactly this
 *  recalc, so this measures the per-mousemove jank a bg image introduces.
 *
 *  Relative A/B only — absolute ms will differ from the user's machine, but
 *  the ratio between the two selectors is what we're after.
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { withBrowser } from "/mnt/c/Users/markr/work/tools/chromium-driver/lib/browser.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const sandbox = path.join(here, "bg-hex-recalc-bench.html");

const result = await withBrowser(async ({ page }) => {
  await page.goto(pathToFileURL(sandbox).href, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.title === "ready", { timeout: 10000 });
  return page.evaluate(() => window.__runBench(40));
});

const f = (n) => n.toFixed(2).padStart(8);
console.log(`\nFull grid rebuild + layout flush (the renderGrid open-time cost)`);
console.log(`hexes=${result.hexCount}  painted=${result.painted}  empty=${result.empty}  iters=${result.iters}\n`);
console.log(`                       median      mean       p95   (ms)`);
console.log(`no bg image         ${f(result.none.median)}  ${f(result.none.mean)}  ${f(result.none.p95)}  baseline`);
console.log(`bg + attr selector  ${f(result.attr.median)}  ${f(result.attr.mean)}  ${f(result.attr.p95)}  (current)`);
console.log(`bg + class selector ${f(result.cls.median)}  ${f(result.cls.mean)}  ${f(result.cls.p95)}  (proposed)`);
console.log(`\nbg overhead (attr vs none): ${(result.attr.median - result.none.median).toFixed(2)} ms/render`);
console.log(`selector saving (attr→class): ${(result.attr.median - result.cls.median).toFixed(2)} ms/render\n`);
