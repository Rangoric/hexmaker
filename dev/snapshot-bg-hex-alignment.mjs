#!/usr/bin/env node
/** Verify that the bg-hex alignment fix actually holds across a top-expand
 *  click — visually AND numerically.
 *
 *  Captures four PNGs:
 *    1. baseline       — before any click
 *    2. broken-after   — top-expand using pan-only comp (the bug we just fixed)
 *    3. fixed-after    — top-expand using pan + bg.offsetY comp (the fix)
 *    4. fixed-thrice   — three sequential clicks of the fix, to confirm
 *                        cumulative alignment doesn't drift
 *
 *  Also parses the sandbox's #status text and asserts that the screen y of
 *  the top-left hex AND of the bg feature are both unchanged after each
 *  "fixed" click. If they drift, the test fails loudly.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import fs from "node:fs/promises";
import { withBrowser } from "/mnt/c/Users/markr/work/tools/chromium-driver/lib/browser.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const sandbox = path.join(here, "bg-hex-alignment-sandbox.html");
const outDir = path.join(here, "out");

await fs.mkdir(outDir, { recursive: true });

const results = await withBrowser(
  async ({ page }) => {
    await page.goto(pathToFileURL(sandbox).href, { waitUntil: "networkidle0" });

    const snap = async (name) => {
      const clip = await page.$(".duckmage-hex-map-clip");
      const outPath = path.join(outDir, `${name}.png`);
      await clip.screenshot({ path: outPath });
      return outPath;
    };

    const readStatus = () =>
      page.$eval("#status", (el) => el.textContent);

    const parseStatus = (s) => {
      const hex = /hex \(logical 0,0\) screen y=([\d.]+)/.exec(s);
      const bg = /bg feature screen y=([\d.]+)/.exec(s);
      return {
        hexY: hex ? parseFloat(hex[1]) : NaN,
        bgY: bg ? parseFloat(bg[1]) : NaN,
      };
    };

    const baselineStatus = await readStatus();
    const baseline = parseStatus(baselineStatus);
    const outs = [];
    outs.push(await snap("alignment-1-baseline"));

    // === broken (pan only) ===
    await page.click("#btn-reset");
    await new Promise((r) => setTimeout(r, 50));
    await page.click("#btn-top-broken");
    await new Promise((r) => setTimeout(r, 50));
    const brokenStatus = await readStatus();
    const broken = parseStatus(brokenStatus);
    outs.push(await snap("alignment-2-broken-after"));

    // === fixed (pan + bg.offsetY) ===
    await page.click("#btn-reset");
    await new Promise((r) => setTimeout(r, 50));
    await page.click("#btn-top");
    await new Promise((r) => setTimeout(r, 50));
    const fixedStatus = await readStatus();
    const fixed = parseStatus(fixedStatus);
    outs.push(await snap("alignment-3-fixed-after"));

    // === fixed thrice ===
    await page.click("#btn-reset");
    await new Promise((r) => setTimeout(r, 50));
    for (let i = 0; i < 3; i++) {
      await page.click("#btn-top");
      await new Promise((r) => setTimeout(r, 50));
    }
    const thriceStatus = await readStatus();
    const thrice = parseStatus(thriceStatus);
    outs.push(await snap("alignment-4-fixed-thrice"));

    return { baseline, broken, fixed, thrice, outs };
  },
  { viewport: { width: 800, height: 600 } },
);

for (const o of results.outs) console.log(o);

// === Assert ===
const TOL = 0.6; // sub-pixel rounding tolerance
const lines = [];
const ok = (cond, msg) => lines.push(`${cond ? "✓" : "✗"} ${msg}`);

ok(
  Math.abs(results.fixed.hexY - results.baseline.hexY) < TOL,
  `fixed: hex screen y stable (baseline=${results.baseline.hexY.toFixed(1)}, after=${results.fixed.hexY.toFixed(1)})`,
);
ok(
  Math.abs(results.fixed.bgY - results.baseline.bgY) < TOL,
  `fixed: bg feature screen y stable (baseline=${results.baseline.bgY.toFixed(1)}, after=${results.fixed.bgY.toFixed(1)})`,
);
ok(
  Math.abs(results.broken.hexY - results.baseline.hexY) < TOL,
  `broken: hex screen y stable (baseline=${results.baseline.hexY.toFixed(1)}, after=${results.broken.hexY.toFixed(1)})`,
);
ok(
  Math.abs(results.broken.bgY - results.baseline.bgY) >= TOL,
  `broken: bg feature DOES drift (baseline=${results.baseline.bgY.toFixed(1)}, after=${results.broken.bgY.toFixed(1)}) — this is the original bug`,
);
ok(
  Math.abs(results.thrice.hexY - results.baseline.hexY) < TOL,
  `fixed×3: hex screen y stable after 3 clicks (baseline=${results.baseline.hexY.toFixed(1)}, after=${results.thrice.hexY.toFixed(1)})`,
);
ok(
  Math.abs(results.thrice.bgY - results.baseline.bgY) < TOL,
  `fixed×3: bg feature screen y stable after 3 clicks (baseline=${results.baseline.bgY.toFixed(1)}, after=${results.thrice.bgY.toFixed(1)})`,
);

const allOk = lines.every((l) => l.startsWith("✓"));
console.log("\n--- alignment checks ---");
for (const l of lines) console.log(l);
console.log(allOk ? "\nPASS" : "\nFAIL");
if (!allOk) process.exit(1);
