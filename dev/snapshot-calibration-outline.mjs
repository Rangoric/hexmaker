#!/usr/bin/env node
/** Snap the calibration outline sandbox under the conditions where the
 *  double-grid bug was reported (pointy + flat, plain + scaled grid). */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCssVariants } from "/mnt/c/Users/markr/work/tools/frontend-testing/scripts/css-variant-runner.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

const results = await runCssVariants({
  html: path.join(here, "calibration-outline-overlay-sandbox.html"),
  outDir: path.join(here, "out"),
  variants: [
    { name: "pointy-1x", urlSuffix: "" },
    { name: "pointy-2x", urlSuffix: "?scale=2" },
    { name: "flat-1x",   urlSuffix: "?orient=flat" },
    { name: "flat-2x",   urlSuffix: "?orient=flat&scale=2" },
  ],
  viewport: { width: 800, height: 600 },
});

for (const r of results) console.log(r.outputPath);
