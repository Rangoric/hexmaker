#!/usr/bin/env node
/** Behavioural checks for the issue #32 fixes, run against the REAL
 *  styles.css and the exact algorithms shipped in the plugin:
 *   1. `.duckmage-hide-coords` hides the HTML coord-label layer
 *   2. `.duckmage-hide-paths` hides path lines but not GM icons
 *   3. per-drag document listeners survive re-parenting into a popout
 *      document (adoptNode reproduces Obsidian's "Move to new window"),
 *      with a control proving the pre-fix strategy dies
 *   4. the PNG-export tint composite produces solid tint in the icon's
 *      alpha shape
 *  Exits non-zero if any in-page check fails. Screenshots land in dev/out.
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs/promises";
import { withBrowser } from "/mnt/c/Users/markr/work/tools/chromium-driver/lib/browser.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const harness = path.join(here, "issue32-fixes-check.html");
const outDir = path.join(here, "out");
await fs.mkdir(outDir, { recursive: true });

let failed = false;

await withBrowser(
  async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));

    await page.goto(pathToFileURL(harness).href, { waitUntil: "networkidle0" });
    await page.waitForSelector("#summary", { timeout: 5000 });

    // Full-page shot: pass/fail rows + tint strips + overlay stage
    await page.screenshot({
      path: path.join(outDir, "issue32-checks.png"),
      fullPage: true,
    });
    console.log(path.join(outDir, "issue32-checks.png"));

    // Visual before/after of the overlay toggles
    const stage = await page.$(".stage");
    await stage.screenshot({ path: path.join(outDir, "issue32-overlays-on.png") });
    await page.click("#toggleCoords");
    await page.click("#togglePaths");
    await stage.screenshot({ path: path.join(outDir, "issue32-overlays-off.png") });
    console.log(path.join(outDir, "issue32-overlays-on.png"));
    console.log(path.join(outDir, "issue32-overlays-off.png"));

    const summary = await page.$eval("#summary", (el) => ({
      ok: el.dataset.ok === "true",
      passed: el.dataset.passed,
      total: el.dataset.total,
    }));
    const rows = await page.$$eval(".test-row", (els) =>
      els.filter((e) => e.id !== "summary").map((e) => e.textContent),
    );
    for (const r of rows) console.log(r);
    console.log(`summary: ${summary.passed}/${summary.total} passed`);

    if (pageErrors.length) {
      console.error("page errors:", pageErrors);
      failed = true;
    }
    if (!summary.ok) failed = true;
  },
  { viewport: { width: 900, height: 900 } },
);

process.exit(failed ? 1 : 0);
