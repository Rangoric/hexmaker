#!/usr/bin/env node
/**
 * Snapshot every CSS approach in hex-calibration-sandbox.html.
 *
 * Now wraps the shared frontend-testing runner instead of duplicating
 * playwright/puppeteer wiring. Output: dev/out/approach-{a..e}.png.
 *
 *   node dev/screenshot-approaches.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCssVariants } from "/mnt/c/Users/markr/work/tools/frontend-testing/scripts/css-variant-runner.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

const results = await runCssVariants({
  html: path.join(here, "hex-calibration-sandbox.html"),
  outDir: path.join(here, "out"),
  variants: [
    { name: "approach-a", click: `.controls button[data-approach="a"]` },
    { name: "approach-b", click: `.controls button[data-approach="b"]` },
    { name: "approach-c", click: `.controls button[data-approach="c"]` },
    { name: "approach-d", click: `.controls button[data-approach="d"]` },
    { name: "approach-e", click: `.controls button[data-approach="e"]` },
  ],
  selector: ".bg-image",
  viewport: { width: 800, height: 600 },
});

for (const r of results) console.log(r.outputPath);
